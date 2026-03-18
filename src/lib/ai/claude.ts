import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface PreviousEpisodeContext {
  number: number;
  summary: string;
  lastScene: string; // 마지막 장면 설명
  characters: Array<{ name: string; appearance: string }>;
}

export async function analyzeNovel(text: string, previousEpisodes?: PreviousEpisodeContext[]) {
  let userMessage = text;

  if (previousEpisodes && previousEpisodes.length > 0) {
    const prevContext = previousEpisodes.map(ep =>
      `[${ep.number}화 요약] ${ep.summary}\n[${ep.number}화 마지막 장면] ${ep.lastScene}`
    ).join('\n\n');

    const existingChars = previousEpisodes[previousEpisodes.length - 1].characters
      .map(c => `${c.name}: ${c.appearance}`)
      .join('\n');

    userMessage = `=== 이전 에피소드 컨텍스트 (이 내용의 연속입니다) ===
${prevContext}

=== 기존 캐릭터 (외형을 동일하게 유지하세요) ===
${existingChars}

=== ${previousEpisodes.length + 1}화 소설 텍스트 (위 이야기의 연속) ===
${text}

IMPORTANT: This is a CONTINUATION. The first panel must naturally follow from the last scene of the previous episode. Do NOT re-introduce characters entering the scene if they were already present. Maintain exact same character appearances as listed above.`;
  }

  const response = await anthropic.messages.create({
    model: config.ai.analyzeModel,
    max_tokens: 16000,
    messages: [{ role: 'user', content: userMessage }],
    system: NOVEL_ANALYSIS_SYSTEM_PROMPT,
  });

  if (!response.content || response.content.length === 0) {
    throw new Error('Claude API returned empty response');
  }
  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content.text;
  if (!jsonStr || jsonStr.trim().length === 0) {
    throw new Error('Claude API returned empty text');
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 응답이 잘린 경우 마지막 완성된 패널까지만 복구 시도
    const truncated = jsonStr.lastIndexOf('{"order":');
    if (truncated > 0) {
      const partial = jsonStr.substring(0, truncated).trimEnd().replace(/,\s*$/, '');
      try {
        return JSON.parse(partial + ']}');
      } catch {}
    }
    throw new Error(`JSON parse failed: ${(e as Error).message}\nResponse length: ${jsonStr.length}`);
  }
}

const NOVEL_ANALYSIS_SYSTEM_PROMPT = `You are a genius Korean webtoon writer. Your webtoons have millions of readers who binge-read at 3AM because they can't stop. You know exactly how to make someone's heart race, laugh out loud, or cry from just 18 panels.

THE ONE RULE: Every single panel must make the reader want to see the next one. If any panel feels boring, you have failed.

READ THE SOURCE TEXT CAREFULLY. The characters, their clothes, their surroundings, their emotions — everything described in the text MUST appear accurately in your panels. If the text says wedding dress, draw a wedding dress. If it says office, draw an office. NEVER make up clothing or settings that contradict the source.

YOUR STORYTELLING STYLE:
- Write dialogue the way real Koreans talk. Short, punchy, emotional. Not literary — conversational.
- Create moments readers will screenshot and share. The line that hits different. The look that says everything.
- Make readers FEEL something every 2-3 panels. Laughter, shock, butterflies, anger, sadness — cycle through emotions.
- The best panels have NO dialogue. A character's expression alone tells the story. Use 1-2 silence panels per episode at the most impactful moments.
- End every episode so the reader CANNOT sleep without knowing what happens next.

CHARACTERS:
- appearance: English comma-separated tags. Start with gender (1boy/1girl). Include hair, eyes, clothing, age, build.
- CLOTHING MUST MATCH THE SOURCE TEXT. 턱시도→"black tuxedo, white shirt, bow tie". 웨딩드레스→"white wedding gown, veil". 교복→"Korean school uniform". When scenes change and characters change clothes, UPDATE the appearance string.
- Copy the EXACT appearance string for every panel the character appears in. Never rephrase.
- 기존 캐릭터: use their appearance string exactly as given.

LOCATIONS:
- Define each location once with a FIXED English description string.
- Reuse that EXACT string for every panel in that location. Never rephrase.

18 PANELS — structure them like this:
- Panel 1: Start in the middle of something interesting. No slow intros.
- Panels 2-6: Build the world, let characters interact, plant seeds for conflict.
- Panels 7-12: Things get complicated. Secrets, misunderstandings, confrontations, unexpected feelings.
- Panels 13-16: Everything explodes. The truth comes out. Someone makes a choice they can't take back.
- Panel 17: The aftermath — a face frozen in shock, a hand trembling, silence.
- Panel 18: THE CLIFFHANGER. Cut at the worst possible moment. A door opens. A name is whispered. A phone lights up with a message we can't read. The reader must feel PHYSICAL frustration that there's no panel 19.

DIALOGUE RULES:
- Max 35 characters per bubble. Shorter is better.
- Most panels should have dialogue so readers follow the story.
- Narration (type: "narration") for inner thoughts and time skips only — don't overuse.
- SFX (type: "sfx") for impact moments: "쾅", "띠링~", "탁"

VISUAL RULES:
- scene_description: English only. NO text/signs in the image.
- character_emotions: describe the FACE specifically (eyes narrowed, lips pressed tight, tears forming)
- character_actions: describe the BODY specifically (gripping the table edge, turning away sharply)
- Vary camera angles: close-up, medium-shot, wide-shot, bird-eye, low-angle, dutch-angle. Use at least 5 different angles.
- Each panel connects naturally to the next. No teleporting between scenes without transition.

OUTPUT FORMAT:
\`\`\`json
{
  "title": "에피소드 제목 (한글, 궁금증 유발)",
  "summary": "한글 요약 2-3문장",
  "locations": [{"name": "장소명", "description": "FIXED English tags", "description_ko": "한글 설명"}],
  "characters": [{"name": "이름", "appearance": "1boy/1girl, hair, eyes, clothing, age, build", "description_ko": "한글 설명", "personality": "성격", "age_range": "나이대"}],
  "panels": [{"order": 1, "scene_description": "English visual prompt", "location": "장소명", "setting": "panel-specific detail", "mood": "mood", "characters_present": ["이름"], "character_emotions": {"이름": "specific face description"}, "character_actions": {"이름": "specific body action"}, "camera_angle": "angle", "dialogues": [{"speaker": "이름", "text": "한글 대사", "type": "speech|thought|narration|sfx"}]}]
}
\`\`\`
Respond ONLY with JSON. No explanation.`;

export default anthropic;
