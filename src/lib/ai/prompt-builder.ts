import type { PanelData, CharacterData, LocationData } from '@/types/scene';
import { prisma } from '@/lib/db';
import { getStylePreset } from '@/lib/styles';

const NO_TEXT_SUFFIX = `NO TEXT: Zero letters, numbers, words, signs, labels, watermarks in any language. Signs/labels must be blank or illegible.`;

// ---------------------------------------------------------------------------
// Character sheet
// ---------------------------------------------------------------------------

export function buildCharacterSheetPrompt(character: CharacterData, styleKey = 'drama'): string {
  const style = getStylePreset(styleKey);
  const isFemale = character.appearance.includes('1girl') || character.appearance.includes('woman');
  const genderLine = isFemale
    ? 'FEMALE character. Draw as a woman.'
    : 'MALE character. Draw as a man. NO feminine features.';

  return `Character design reference sheet. White background.
Layout: front view (full body), 3/4 view, side profile, plus 4 face close-ups (happy, sad, angry, surprised).

Character: ${character.appearance}

${genderLine}

Art style: ${style.stylePrompt}
Color tone: ${style.colorTone}
Consistent proportions and style across all views.

${NO_TEXT_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// Panel prompt
// ---------------------------------------------------------------------------

const CAMERA: Record<string, string> = {
  'close-up':    'CLOSE-UP shot. Face and upper chest. Detailed expression.',
  'medium-shot': 'MEDIUM SHOT. Waist up. Shows gestures.',
  'wide-shot':   'WIDE SHOT. Full scene, full body characters, detailed background.',
  'bird-eye':    'BIRD-EYE VIEW. Looking down from above.',
  'low-angle':   'LOW ANGLE. Looking up at character.',
  'dutch-angle': 'DUTCH ANGLE. Slightly tilted for tension.',
};

export function buildPanelPrompt(
  panel: PanelData,
  characters: Map<string, CharacterData>,
  locations?: Map<string, LocationData>,
  styleKey = 'drama',
): string {
  const style = getStylePreset(styleKey);
  const camera = CAMERA[panel.camera_angle] || 'MEDIUM SHOT.';

  // 캐릭터 (간결하게: 외형 태그 + 감정 + 행동)
  const characterLines = panel.characters_present
    .map((name) => {
      const char = characters.get(name);
      if (!char) return '';
      const appearance = char.promptPrefix || char.appearance;
      const isMale = !appearance.includes('1girl') && !appearance.includes('woman');
      const genderTag = isMale ? 'MALE' : 'FEMALE';
      const emotion = panel.character_emotions?.[name] || 'neutral';
      const action = panel.character_actions?.[name] || 'standing';
      return `[${name}] ${genderTag}. ${appearance}. Expression: ${emotion}. Action: ${action}. EXACT same appearance as reference — face, hair, clothing unchanged.`;
    })
    .filter(Boolean)
    .join('\n');

  // 배경 (장소 고정 설명 + 패널별 추가)
  let bg = '';
  if (panel.location && locations) {
    const loc = locations.get(panel.location);
    if (loc) {
      bg = `Background: ${loc.description}`;
      if (panel.setting) bg += `. ${panel.setting}`;
    }
  } else if (panel.setting) {
    bg = `Background: ${panel.setting}`;
  }

  const mood = panel.mood ? `Mood: ${panel.mood}.` : '';

  return `${style.stylePrompt} Color tone: ${style.colorTone}.

${camera}

Scene: ${panel.scene_description}

${characterLines}

${bg} ${mood}

${NO_TEXT_SUFFIX}`;
}

// ---------------------------------------------------------------------------
// Regeneration
// ---------------------------------------------------------------------------

export function buildRegenerationPrompt(originalPrompt: string, feedback: string): string {
  return `${originalPrompt}\n\nFIX: ${feedback}`;
}

// ---------------------------------------------------------------------------
// Learned rules (DB에서 QA가 학습한 프롬프트 개선)
// ---------------------------------------------------------------------------

export async function getLearnedRules(): Promise<string> {
  try {
    const rules = await prisma.promptImprovement.findMany({
      where: { active: true },
      orderBy: { score: 'desc' },
      take: 6,
    });
    if (rules.length === 0) return '';
    return rules.map(r => r.rule).join('. ') + '.';
  } catch {
    return '';
  }
}

export async function buildPanelPromptWithLearning(
  panel: PanelData,
  characters: Map<string, CharacterData>,
  locations?: Map<string, LocationData>,
  styleKey = 'drama',
): Promise<string> {
  const basePrompt = buildPanelPrompt(panel, characters, locations, styleKey);
  const learnedRules = await getLearnedRules();
  if (!learnedRules) return basePrompt;
  return `${basePrompt}\n\nLEARNED RULES: ${learnedRules}`;
}
