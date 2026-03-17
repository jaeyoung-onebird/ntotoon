import type { PanelData, CharacterData, LocationData } from '@/types/scene';
import { prisma } from '@/lib/db';

// 핵심: 모든 패널에 동일하게 적용되는 스타일 지시
// 자연어 형태가 Flux Dev에서 더 잘 작동함
const STYLE_PREFIX = `A single panel from a Korean webtoon (manhwa). Digital illustration with clean black outlines, flat cel-shading coloring, soft shadows, and vibrant but natural colors. The art style is consistent with modern Korean webtoon series like Lookism or Weak Hero — clean character designs, natural facial expressions, emotionally expressive but not overly dramatic. Avoid overly intense or aggressive expressions. Professional quality digital art.`;

const NO_TEXT_SUFFIX = `CRITICAL RULE: This image must contain ZERO text. No letters, no numbers, no words, no characters in any language (Korean, English, Japanese, Chinese), no signs, no labels, no watermarks, no captions, no speech bubbles, no onomatopoeia. If there would be a sign or label in the scene, make it blank or illegible. Pure visual illustration only.`;

export function buildCharacterSheetPrompt(character: CharacterData): string {
  const isFemale = character.appearance.includes('1girl') || character.appearance.includes('woman');
  const genderInstruction = isFemale
    ? 'CRITICAL: This character is FEMALE. Draw as a woman.'
    : 'CRITICAL: This character is MALE. Draw as a man. Do NOT draw a woman or feminine features.';

  return `A professional character design reference sheet for a Korean webtoon character. White background. The sheet shows the same character from multiple angles: front view (full body), three-quarter view, and side profile. Below are 4 facial expression close-ups showing happy, sad, angry, and surprised expressions.

The character: ${character.appearance}

${genderInstruction}

Art style: Korean manhwa (Lookism / Weak Hero style), clean lineart, cel shading, vibrant colors, consistent proportions across all views. Sharp masculine facial features for male characters.

${NO_TEXT_SUFFIX}`;
}

export function buildPanelPrompt(
  panel: PanelData,
  characters: Map<string, CharacterData>,
  locations?: Map<string, LocationData>
): string {
  // 카메라 앵글 자연어 설명
  const cameraDescriptions: Record<string, string> = {
    'close-up': 'The shot is a close-up, focusing on the face and upper chest, showing detailed facial expression with soft and natural features.',
    'medium-shot': 'The shot is a medium shot from the waist up, showing the character\'s upper body and gestures.',
    'wide-shot': 'The shot is a wide establishing shot showing the full scene, characters in full body, with detailed background environment.',
    'bird-eye': 'The shot is from a high bird\'s-eye view, looking down at the scene from above.',
    'low-angle': 'The shot is from a low angle, looking upward at the character.',
    'dutch-angle': 'The shot uses a slightly tilted angle for visual interest.',
  };

  const camera = cameraDescriptions[panel.camera_angle] || 'The shot is a medium shot showing the upper body.';

  // 캐릭터 묘사 (각 캐릭터의 고정된 외형 태그를 자연어로 풀어서)
  const characterParts = panel.characters_present
    .map((name) => {
      const char = characters.get(name);
      if (!char) return '';
      const appearance = char.promptPrefix || char.appearance;
      const emotion = panel.character_emotions?.[name] || '';
      const action = panel.character_actions?.[name] || '';
      const genderTag = appearance.includes('1girl') || appearance.includes('woman') ? 'female character' : 'male character';
      return `A ${genderTag} with ${appearance}. Their expression is ${emotion || 'neutral'}. They are ${action || 'standing'}. CRITICAL: This character's gender is fixed — do NOT change it. Keep every clothing detail identical to the reference sheet — same tie knot, collar shape, shirt color, jacket style, and all accessories. Do not alter any outfit element.`;
    })
    .filter(Boolean)
    .join(' ');

  const moodDescription = panel.mood ? `The overall mood is ${panel.mood}.` : '';

  // 배경: location 고정 설명 + 패널별 추가 설명
  let settingDescription = '';
  if (panel.location && locations) {
    const loc = locations.get(panel.location);
    if (loc) {
      settingDescription = `The background is: ${loc.description}.`;
      if (panel.setting) settingDescription += ` Additional detail: ${panel.setting}.`;
    }
  }
  if (!settingDescription && panel.setting) {
    settingDescription = `The background shows ${panel.setting}.`;
  }

  return `TEXT-FREE ILLUSTRATION. ${STYLE_PREFIX}

${camera}

Scene: ${panel.scene_description}

${characterParts}

${settingDescription} ${moodDescription}

Maintain exact same character appearance as shown in the reference image. Same face structure, same hairstyle, same hair color, same clothing. Do not change any character features.

${NO_TEXT_SUFFIX}`;
}

export function buildRegenerationPrompt(
  originalPrompt: string,
  feedback: string
): string {
  return `${originalPrompt}\n\nAdditional direction: ${feedback}`;
}

// DB에서 학습된 프롬프트 규칙을 가져와서 문자열로 반환
export async function getLearnedRules(): Promise<string> {
  try {
    const rules = await prisma.promptImprovement.findMany({
      where: { active: true },
      orderBy: { score: 'desc' },
      take: 8,
    });
    if (rules.length === 0) return '';
    return rules.map(r => r.rule).join('. ') + '.';
  } catch {
    return '';
  }
}

// 학습된 규칙이 적용된 패널 프롬프트 (async 버전)
export async function buildPanelPromptWithLearning(
  panel: PanelData,
  characters: Map<string, CharacterData>,
  locations?: Map<string, LocationData>
): Promise<string> {
  const basePrompt = buildPanelPrompt(panel, characters, locations);
  const learnedRules = await getLearnedRules();
  if (!learnedRules) return basePrompt;
  return `${basePrompt}\n\nAdditional learned rules: ${learnedRules}`;
}
