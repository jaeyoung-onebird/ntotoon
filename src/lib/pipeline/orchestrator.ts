import { analyzeText } from '@/lib/ai/text-analyzer';
import { getStylePreset } from '@/lib/styles';
import { buildCharacterSheetPrompt, buildPanelPromptWithLearning } from '@/lib/ai/prompt-builder';
import { generateCharacterSheet, generatePanel } from '@/lib/ai/image-generator';
import { getStyleReferenceBuffers } from '@/lib/ai/style-references';
import { addSpeechBubbles } from '@/lib/image/speech-bubbles';
import { cropFaceFromSheet } from '@/lib/image/crop-face';
import { assembleWebtoon } from '@/lib/image/webtoon-assembler';
import { uploadToS3 } from '@/lib/s3';
import { prisma } from '@/lib/db';
import type { AnalysisResult, CharacterData, LocationData, PanelData } from '@/types/scene';
import type { PipelineProgress } from '@/types/pipeline';
import { runAutoQA } from '@/lib/qa/auto-qa';
import { calculateBubblePlacements } from '@/lib/image/bubble-placer';
import { deductCredits, estimateGenerationCost } from '@/lib/credits';
import fs from 'fs/promises';
import path from 'path';
import { captureException } from '@/lib/error-reporter';

type ProgressCallback = (progress: PipelineProgress) => void;

export async function runPipeline(
  projectId: string,
  onProgress: ProgressCallback
): Promise<string> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });

  const styleKey = project.style || 'drama';
  const stylePreset = getStylePreset(styleKey);
  // 프로젝트 커스텀 스타일 레퍼런스 (작가가 직접 업로드한 이미지)
  const customStyleUrls = (project.styleRefs as string[] | null) ?? [];

  let episodeId: string | null = null;
  try {
    // Step 1: Analyze text (이전 에피소드 컨텍스트 포함)
    onProgress({ step: 'analyzing', progress: 5, message: '소설 텍스트를 분석하는 중...' });
    await prisma.project.update({ where: { id: projectId }, data: { status: 'ANALYZING' } });

    // 이전 에피소드 컨텍스트 수집
    const prevEpisodes = await prisma.episode.findMany({
      where: { projectId },
      orderBy: { number: 'asc' },
      include: {
        panels: {
          orderBy: { orderIndex: 'desc' },
          take: 1,
          select: { sceneDescription: true },
        },
      },
    });
    const existingChars = await prisma.character.findMany({ where: { projectId } });

    const previousContext = prevEpisodes.length > 0
      ? prevEpisodes.map(ep => ({
          number: ep.number,
          summary: ep.summary || '',
          lastScene: ep.panels[0]?.sceneDescription || '',
          characters: existingChars.map(c => ({ name: c.name, appearance: c.description })),
        }))
      : undefined;

    // 텍스트가 너무 짧으면 자동 확장 (300자 미만)
    let novelText = project.novelText;
    if (novelText.trim().length < 300) {
      onProgress({ step: 'analyzing', progress: 8, message: '텍스트가 짧아 AI가 자동으로 내용을 보충합니다...' });
      try {
        const { expandText } = await import('@/lib/ai/expander');
        novelText = await expandText(novelText, existingChars, prevEpisodes);
      } catch { /* 실패하면 원본 사용 */ }
    }

    const analysis: AnalysisResult = await analyzeText(novelText, previousContext);
    onProgress({ step: 'analyzing', progress: 15, message: `분석 완료: ${analysis.panels.length}개 패널, ${analysis.characters.length}명 캐릭터, ${analysis.locations?.length || 0}개 장소` });

    // 장소 맵 생성 (배경 일관성)
    const locationMap = new Map<string, LocationData>();
    if (analysis.locations) {
      for (const loc of analysis.locations) {
        locationMap.set(loc.name, loc);
      }
    }

    // 기존 캐릭터 확인 (시리즈 연재: 2화 이상이면 기존 캐릭터 재사용)
    const isNewSeries = existingChars.length === 0;

    const characterMap = new Map<string, CharacterData>();

    if (isNewSeries) {
      // 새 시리즈: 캐릭터 DB에 저장
      for (const char of analysis.characters) {
        await prisma.character.create({
          data: {
            projectId,
            name: char.name,
            description: char.description_ko || char.appearance,
            promptPrefix: char.appearance,
            metadata: { personality: char.personality, age_range: char.age_range, description_ko: char.description_ko },
          },
        });
        characterMap.set(char.name, { ...char, promptPrefix: char.appearance });
      }
    } else {
      // 연재 중: 기존 캐릭터 로드 + 새 캐릭터만 추가
      for (const existing of existingChars) {
        characterMap.set(existing.name, {
          name: existing.name,
          appearance: existing.promptPrefix || existing.description,
          personality: (existing.metadata as { personality?: string })?.personality || '',
          age_range: (existing.metadata as { age_range?: string })?.age_range || '',
          promptPrefix: existing.promptPrefix || existing.description,
          referenceSheet: existing.referenceSheet || undefined,
        });
      }
      // 새로 등장하는 캐릭터가 있으면 추가
      for (const char of analysis.characters) {
        if (!characterMap.has(char.name)) {
          await prisma.character.create({
            data: {
              projectId,
              name: char.name,
              description: char.appearance,
              promptPrefix: char.appearance,
              metadata: { personality: char.personality, age_range: char.age_range },
            },
          });
          characterMap.set(char.name, { ...char, promptPrefix: char.appearance });
        }
      }
    }

    // 에피소드 번호 계산
    const lastEpisode = await prisma.episode.findFirst({
      where: { projectId },
      orderBy: { number: 'desc' },
    });
    const nextNumber = (lastEpisode?.number ?? 0) + 1;

    const episode = await prisma.episode.create({
      data: {
        projectId,
        number: nextNumber,
        title: analysis.title || `${nextNumber}화`,
        summary: analysis.summary,
        novelText: project.novelText,
      },
    });
    episodeId = episode.id;

    // Step 2: 캐릭터 시트 (기존이면 건너뛰기, 새 캐릭터만 생성)
    await prisma.project.update({ where: { id: projectId }, data: { status: 'GENERATING' } });

    const characterRefBuffers = new Map<string, Buffer>();
    const characterFaceBuffers = new Map<string, Buffer>();

    // 기존 캐릭터의 시트를 메모리에 로드 (레퍼런스용)
    const allCharacters = await prisma.character.findMany({ where: { projectId } });
    const charsNeedingSheet: typeof allCharacters = allCharacters.filter(c => !c.referenceSheet);
    const charsWithSheet = allCharacters.filter(c => c.referenceSheet);

    // 기존 시트 로드
    for (const char of charsWithSheet) {
      onProgress({
        step: 'characters',
        progress: 16,
        message: `기존 캐릭터 로드: ${char.name}`,
      });
      try {
        const sheetPath = path.join(process.cwd(), 'public', char.referenceSheet!);
        const buffer = await fs.readFile(sheetPath);
        characterRefBuffers.set(char.name, buffer);

        const faceBuffer = await cropFaceFromSheet(buffer);
        characterFaceBuffers.set(char.name, faceBuffer);
      } catch {
        // 파일 없으면 새로 생성
        charsNeedingSheet.push(char);
      }
    }

    // 새 캐릭터 시트 생성
    let charIndex = 0;
    for (const char of charsNeedingSheet) {
      charIndex++;
      const charData = characterMap.get(char.name);
      if (!charData) continue;

      onProgress({
        step: 'characters',
        progress: 15 + Math.round((charIndex / Math.max(charsNeedingSheet.length, 1)) * 15),
        message: `캐릭터 시트 생성 중: ${char.name} (${charIndex}/${charsNeedingSheet.length})`,
      });

      const prompt = buildCharacterSheetPrompt(charData, styleKey);
      const imageBuffer = await generateCharacterSheet(prompt);

      const s3Key = `projects/${projectId}/characters/${char.name}/sheet.png`;
      const localUrl = await uploadToS3(imageBuffer, s3Key);

      characterRefBuffers.set(char.name, imageBuffer);

      const faceCropBuffer = await cropFaceFromSheet(imageBuffer);
      characterFaceBuffers.set(char.name, faceCropBuffer);

      await prisma.character.updateMany({
        where: { projectId, name: char.name },
        data: { referenceSheet: localUrl },
      });

      const updated = characterMap.get(char.name);
      if (updated) {
        updated.referenceSheet = localUrl;
        characterMap.set(char.name, updated);
      }
    }

    // Step 3: Generate panels (5개씩 병렬 생성)
    const panelRecords: Array<{ id: string; buffer: Buffer; dialogues: PanelData['dialogues'] }> = [];
    const BATCH_SIZE = 5;

    // 스타일 레퍼런스 로드
    // 1순위: 작가가 직접 업로드한 커스텀 레퍼런스
    // 2순위: golden_images에서 같은 스타일 키의 고득점 패널
    let stylePanelRefs: Buffer[] = [];
    let styleBgRefs: Buffer[] = [];

    if (customStyleUrls.length > 0) {
      onProgress({ step: 'panels', progress: 30, message: `커스텀 스타일 레퍼런스 ${customStyleUrls.length}개 적용 중...` });
      for (const url of customStyleUrls.slice(0, 3)) {
        try {
          const { downloadFromS3 } = await import('@/lib/s3');
          const key = url.startsWith('/') ? url.slice(1) : url;
          const buf = await downloadFromS3(key);
          stylePanelRefs.push(buf);
          styleBgRefs.push(buf);
        } catch { /* skip */ }
      }
    } else {
      stylePanelRefs = await getStyleReferenceBuffers('panel');
      styleBgRefs = await getStyleReferenceBuffers('background');
      if (stylePanelRefs.length > 0) {
        onProgress({ step: 'panels', progress: 30, message: `스타일 레퍼런스 ${stylePanelRefs.length}개 로드됨` });
      }
    }

    onProgress({ step: 'panels', progress: 30, message: `스타일: ${stylePreset.emoji} ${stylePreset.label}` });

    for (let batchStart = 0; batchStart < analysis.panels.length; batchStart += BATCH_SIZE) {
      const batch = analysis.panels.slice(batchStart, batchStart + BATCH_SIZE);

      onProgress({
        step: 'panels',
        progress: 30 + Math.round((batchStart / analysis.panels.length) * 35),
        message: `패널 생성 중: ${batchStart + 1}~${Math.min(batchStart + BATCH_SIZE, analysis.panels.length)}/${analysis.panels.length}`,
      });

      // 배치 내 패널들을 동시에 생성
      const batchResults = await Promise.all(
        batch.map(async (panel, batchIdx) => {
          const i = batchStart + batchIdx;
          const prompt = await buildPanelPromptWithLearning(panel, characterMap, locationMap, styleKey);
          const hasCharacters = panel.characters_present.length > 0;
          // Include both full character sheet and cropped face as references
          // 레퍼런스 전략: 얼굴 크롭 우선 (얼굴이 더 명확), 없으면 시트 사용
          // 패널당 최대 2캐릭터 레퍼런스 (초과 시 주연만)
          const MAX_REFS = 2;
          const refBuffers: Buffer[] = [];
          for (const name of panel.characters_present.slice(0, MAX_REFS)) {
            const face = characterFaceBuffers.get(name);
            const sheet = characterRefBuffers.get(name);
            if (face) refBuffers.push(face);
            else if (sheet) refBuffers.push(sheet);
          }

          const isWideShot = panel.camera_angle === 'wide-shot' || panel.camera_angle === 'bird-eye';
          const styleRefs = isWideShot ? styleBgRefs : stylePanelRefs;
          const imageBuffer = await generatePanel(prompt, hasCharacters, refBuffers.length > 0 ? refBuffers : undefined, styleRefs.length > 0 ? styleRefs : undefined);
          const s3Key = `projects/${projectId}/episodes/${episode.id}/panels/${i}_raw.png`;
          const rawUrl = await uploadToS3(imageBuffer, s3Key);

          // Save panel to DB
          const panelRecord = await prisma.panel.create({
            data: {
              episodeId: episode.id,
              orderIndex: i,
              sceneDescription: panel.scene_description,
              setting: panel.setting,
              mood: panel.mood,
              cameraAngle: panel.camera_angle,
              imagePrompt: prompt,
              rawImageUrl: rawUrl,
            },
          });

          // Save dialogues
          await Promise.all(
            panel.dialogues.map((dialogue, d) =>
              prisma.dialogue.create({
                data: {
                  panelId: panelRecord.id,
                  orderIndex: d,
                  speaker: dialogue.speaker,
                  text: dialogue.text,
                  type: dialogue.type.toUpperCase() as 'SPEECH' | 'THOUGHT' | 'NARRATION' | 'SFX',
                },
              })
            )
          );

          // Save panel characters
          await Promise.all(
            panel.characters_present.map(async (charName) => {
              const character = await prisma.character.findFirst({
                where: { projectId, name: charName },
              });
              if (character) {
                await prisma.panelCharacter.create({
                  data: {
                    panelId: panelRecord.id,
                    characterId: character.id,
                    emotion: panel.character_emotions?.[charName],
                    action: panel.character_actions?.[charName],
                  },
                });
              }
            })
          );

          return { id: panelRecord.id, buffer: imageBuffer, dialogues: panel.dialogues };
        })
      );

      panelRecords.push(...batchResults);
    }

    // Step 4: 말풍선 스마트 배치 + 렌더링 (병렬)
    onProgress({ step: 'bubbles', progress: 65, message: `말풍선 배치 분석 중... (${panelRecords.length}개)` });

    const panelsWithBubbles = await Promise.all(
      panelRecords.map(async (panel, i) => {
        // Claude Vision으로 이미지 분석 → 최적 위치 계산
        const placements = await calculateBubblePlacements(panel.buffer, panel.dialogues);
        // 계산된 위치로 말풍선 렌더링
        const dialoguesWithPositions = panel.dialogues.map((d, di) => ({
          ...d,
          positionX: placements[di]?.x,
          positionY: placements[di]?.y,
        }));
        const finalBuffer = await addSpeechBubbles(panel.buffer, dialoguesWithPositions);
        const s3Key = `projects/${projectId}/episodes/${episode.id}/panels/${i}_final.png`;
        const finalUrl = await uploadToS3(finalBuffer, s3Key);

        await prisma.panel.update({
          where: { id: panel.id },
          data: { finalImageUrl: finalUrl },
        });

        return { id: panel.id, buffer: finalBuffer };
      })
    );

    // Step 5: Assemble webtoon
    onProgress({ step: 'assembly', progress: 90, message: '웹툰 이미지 조립 중...' });
    const webtoonBuffer = await assembleWebtoon(
      panelsWithBubbles.map((p) => ({ buffer: p.buffer, id: p.id }))
    );
    const webtoonKey = `projects/${projectId}/episodes/${episode.id}/webtoon.png`;
    const webtoonUrl = await uploadToS3(webtoonBuffer, webtoonKey);

    await prisma.episode.update({
      where: { id: episode.id },
      data: { outputUrl: webtoonUrl },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'COMPLETED' },
    });

    // Step 6: 크레딧 차감 (완료 후 실제 사용량 기준)
    // charsNeedingSheet = 이번에 새로 시트 생성한 캐릭터 수 (재사용은 0)
    const newCharCount = charsNeedingSheet.length;
    const panelsGenerated = panelRecords.length;
    const actualCost = estimateGenerationCost(panelsGenerated, newCharCount);

    const deducted = await deductCredits(
      project.userId,
      actualCost,
      `웹툰 완성: ${project.title} 제${episode.number}화 "${episode.title || ''}"`
    );
    if (!deducted) {
      console.warn(`[Credits] 크레딧 부족으로 차감 실패 (필요: ${actualCost}C)`);
    }

    onProgress({
      step: 'complete',
      progress: 100,
      message: '완료!',
      outputUrl: webtoonUrl,
    });

    // Step 7: 자동 QA (await로 확실히 실행, 실패해도 파이프라인은 성공)
    try {
      await runAutoQA(projectId, episode.id, (msg) => {
        console.log(`[QA] ${msg}`);
      });
      console.log('[QA] Auto QA completed successfully');
    } catch (err) {
      console.error('[QA] Auto QA failed (pipeline still succeeds):', err);
    }

    return webtoonUrl;
  } catch (error) {
    // Clean up partial data on failure
    if (episodeId) {
      await prisma.episode.delete({ where: { id: episodeId } }).catch(() => {});
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'FAILED' },
    });

    const message = error instanceof Error ? error.message : 'Unknown error';
    captureException(error, { tags: { projectId, source: 'pipeline-orchestrator' } });
    onProgress({ step: 'failed', progress: 0, message: `오류 발생: ${message}` });
    throw error;
  }
}
