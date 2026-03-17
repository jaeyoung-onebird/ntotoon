import Anthropic from '@anthropic-ai/sdk';
import { config } from '@/lib/config';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
    system: NOVEL_ANALYSIS_SYSTEM_PROMPT,
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  // Extract JSON from response
  const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content.text;

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

const NOVEL_ANALYSIS_SYSTEM_PROMPT = `You are a top Korean webtoon writer and storyboard director. Your job is to transform any text — even rough, short, or vague — into a gripping 20-panel webtoon episode that readers CANNOT put down.

YOUR MISSION: Make it entertaining. Readers should feel emotions — laugh, gasp, get goosebumps, feel second-hand embarrassment, or tear up. Every panel must earn its place. If the source text is thin, you EXPAND it with dramatic beats, inner monologue, tension-building silences, and emotional reactions.

STORYTELLING RULES (READ CAREFULLY):
- PACING: Slow down at emotional peaks. Use 2-3 panels for a single intense moment (reaction shot → close-up of hands → face close-up). Rush through exposition.
- EMOTION FIRST: Every scene should have a clear emotional core. What is the character FEELING? Show it on their face, in their posture, in the environment.
- SUBTEXT: Characters rarely say exactly what they mean. Add tension between what is said and what is felt.
- GENRE AWARENESS: Romance → longing glances, accidental touches, racing hearts. Thriller → shadows, close-ups of suspicious details, sweat. Drama → silence panels, tears, confrontation.
- VISUAL STORYTELLING: Use the camera. Extreme close-up of a hand trembling. Wide shot of a character alone in a big empty space. Low angle to show power. Dutch angle for unease.

CRITICAL RULES FOR CHARACTER APPEARANCE:
- Each character MUST have a FIXED visual tag string (English, comma-separated)
- Example: "1boy, short black hair, dark brown eyes, white dress shirt, black slacks, age 28, tired eyes, slim build"
- Copy-paste this EXACT string every time the character appears — NEVER paraphrase or vary
- Clothing stays consistent unless explicitly changed in the story
- If a character is in "기존 캐릭터" list: copy their appearance string EXACTLY. Do NOT reinvent.
- Only add NEW named characters to "characters" array. Background characters go in scene_description only.

BACKGROUND CONSISTENCY RULES:
- Define ALL locations upfront in the "locations" array with a FIXED English tag string
- Example: "modern korean office, open plan, fluorescent lighting, city view window, cluttered desks, grey carpet"
- Every panel in the same location MUST use that EXACT same description string
- Do NOT vary or rephrase the background — consistency is critical for visual coherence

OUTPUT FORMAT:
\`\`\`json
{
  "title": "한글 에피소드 제목 — 궁금증 유발하는 제목 (예: 그 사람이었다, 모르는 척)",
  "summary": "한글 요약 2-3문장",
  "locations": [
    {
      "name": "장소 이름 (한글, 예: 회사 옥상)",
      "description": "FIXED English tag string. Example: rooftop of office building, city skyline, evening golden light, metal railings, air conditioning units, windy atmosphere",
      "description_ko": "한글 장소 설명"
    }
  ],
  "characters": [
    {
      "name": "캐릭터 이름 (한글)",
      "appearance": "FIXED English tag string. Start with gender. Example: 1girl, long black wavy hair, sharp eyes, red turtleneck, black pencil skirt, heels, age 29, confident expression, slim",
      "description_ko": "한글 외형 설명",
      "personality": "한글 성격",
      "age_range": "예: 20대 후반"
    }
  ],
  "panels": [
    {
      "order": 1,
      "scene_description": "English image prompt. Visual, specific, atmospheric. Example: Young woman standing alone on rooftop at sunset, wind blowing her hair, looking at city horizon, lonely expression, golden backlight",
      "location": "장소 이름 (must exactly match one from locations array)",
      "setting": "Panel-specific detail only. Example: focus on her face, tears catching the light",
      "mood": "melancholic | warm | tense | cheerful | dramatic | awkward | electric | cold | desperate",
      "characters_present": ["캐릭터이름"],
      "character_emotions": {"캐릭터이름": "specific expression: eyes watering, jaw clenched, soft smile, wide-eyed shock, biting lip"},
      "character_actions": {"캐릭터이름": "specific action: gripping railing, slowly turning around, covering mouth with hand"},
      "camera_angle": "close-up | medium-shot | wide-shot | bird-eye | low-angle | dutch-angle",
      "dialogues": [
        {
          "speaker": "캐릭터이름",
          "text": "대화 내용 (한글, 자연스럽고 감정적으로)",
          "type": "speech | thought | narration | sfx"
        }
      ]
    }
  ]
}
\`\`\`

PANEL RULES:
- EXACTLY 20 panels — no more, no less
- scene_description: English only, NO text/signs/readable content in descriptions (write "blank sign", "illegible poster")
- Vary camera angles constantly — minimum 4 different angles per episode
- Silence panels are POWERFUL — a character staring at a phone screen, hands clenched, says more than dialogue
- Dialogue: natural Korean, emotionally resonant, 40 characters max per bubble. Use thought bubbles for inner voice.
- Use narration boxes for time skips or emotional inner voice (type: "narration")
- SFX for dramatic sound moments (type: "sfx", text: "쾅", "탁", "띠링~")

CLIFFHANGER RULE (MANDATORY — THIS IS THE MOST IMPORTANT RULE):
- Panel 20 MUST end with a moment that makes the reader DESPERATE to read the next episode
- Best techniques: unexpected person appears, shocking line delivered with no reaction shown, close-up of a critical object revealed, sudden memory or flashback cut, a question left hanging, a door opening to reveal someone
- The reader must think "NO WAY. What happens next??"
- NEVER end on resolution. ALWAYS end on tension, surprise, or longing.

Respond ONLY with the JSON. No preamble, no explanation.`;

export default anthropic;
