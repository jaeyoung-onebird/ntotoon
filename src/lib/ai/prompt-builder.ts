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
  'close-up':    'CLOSE-UP shot. Face and upper chest filling the frame. Every micro-expression must be visible — eye moisture, lip tension, brow angle, skin flush.',
  'medium-shot': 'MEDIUM SHOT. Waist up. Show hand gestures, posture, and body language clearly.',
  'wide-shot':   'WIDE SHOT. Full scene with full body characters and detailed background. Body posture conveys emotion.',
  'bird-eye':    'BIRD-EYE VIEW. Looking down from above. Show spatial relationship between characters.',
  'low-angle':   'LOW ANGLE. Looking up at character. Conveys power or intimidation.',
  'dutch-angle': 'DUTCH ANGLE. Tilted frame for psychological tension and unease.',
};

// 감정 키워드를 시각적 얼굴/눈 묘사로 확장
function expandEmotion(emotion: string): string {
  const e = emotion.toLowerCase();
  // 이미 구체적이면 그대로 사용
  if (e.length > 30) return emotion;

  const map: Record<string, string> = {
    'happy': 'bright sparkling eyes, genuine warm smile, raised cheeks, relaxed eyebrows, joyful gaze',
    'sad': 'watery glistening eyes, downturned mouth corners, slightly furrowed brows, defeated gaze looking down, subtle redness around nose',
    'angry': 'sharp narrowed eyes, tightly clenched jaw, furrowed brows pulled together, intense piercing glare, flared nostrils',
    'surprised': 'wide-open round eyes, raised eyebrows high, slightly open mouth, pupils dilated, frozen expression',
    'shocked': 'eyes wide with pupils contracted, mouth agape, eyebrows raised to hairline, blood drained from face, trembling lips',
    'worried': 'anxious darting eyes, brows knitted together, biting lower lip, tense forehead wrinkles, uneasy gaze',
    'scared': 'fear-widened eyes with visible whites, trembling lower lip, pale complexion, shrinking posture, sweat drops on temple',
    'embarrassed': 'flushed red cheeks, averted gaze looking sideways, awkward half-smile, hand near face, slightly hunched shoulders',
    'smirk': 'one corner of mouth raised, knowing eyes, slightly raised eyebrow, confident sideways glance, subtle smugness',
    'crying': 'tears streaming down cheeks, red swollen eyes, scrunched face, quivering chin, glistening tear tracks',
    'cold': 'emotionless flat eyes, perfectly still face, no smile, distant unfocused gaze, stone-like expression',
    'tender': 'soft gentle eyes with warmth, slight caring smile, relaxed face, affectionate gaze, kindness in expression',
    'determined': 'focused intense eyes, set jaw, firm pressed lips, unwavering forward gaze, steely resolve in expression',
    'guilty': 'downcast avoiding eyes, tight pressed lips, furrowed guilty brow, shoulders slightly hunched, unable to meet gaze',
    'longing': 'wistful distant eyes, slightly parted lips, melancholic soft expression, gazing at something far away, bittersweet half-smile',
    'neutral': 'calm composed expression, natural resting face, steady even gaze',
  };

  // 매핑된 감정이 있으면 사용, 없으면 원문 + 기본 강화
  for (const [key, visual] of Object.entries(map)) {
    if (e.includes(key)) return visual;
  }
  return `${emotion} — show this clearly through eyes, eyebrows, mouth, and facial muscle tension`;
}

// 행동 키워드를 구체적 신체 묘사로 확장
function expandAction(action: string): string {
  const a = action.toLowerCase();
  if (a.length > 30) return action;

  const map: Record<string, string> = {
    'standing': 'standing naturally with weight on both feet, arms at sides',
    'sitting': 'seated with natural posture, hands resting',
    'walking': 'mid-stride with natural arm swing, one foot forward',
    'running': 'full sprint with arms pumping, hair and clothes flowing with motion',
    'turning': 'body mid-turn, head leading the rotation, dynamic twisting pose',
    'looking': 'head turned with focused gaze, neck slightly extended',
    'crying': 'shoulders shaking, hands covering face or wiping tears, body curled inward',
    'hugging': 'arms wrapped around the other person, bodies close, genuine embrace',
    'pointing': 'arm extended with index finger directed, assertive posture',
    'phone': 'holding smartphone at eye level, screen glow on face, thumb hovering',
    'drinking': 'hand wrapped around cup, bringing it to lips, slight head tilt',
    'leaning': 'body weight shifted against surface, casual relaxed slouch',
    'grabbing': 'hand gripping tightly, knuckles white, arm tensed',
  };

  for (const [key, visual] of Object.entries(map)) {
    if (a.includes(key)) return visual;
  }
  return `${action} — depict this action with natural body mechanics and weight distribution`;
}

export function buildPanelPrompt(
  panel: PanelData,
  characters: Map<string, CharacterData>,
  locations?: Map<string, LocationData>,
  styleKey = 'drama',
): string {
  const style = getStylePreset(styleKey);
  const camera = CAMERA[panel.camera_angle] || 'MEDIUM SHOT.';

  // 캐릭터 (외형 + 감정을 시각적 디테일로 풀어서 전달)
  const characterLines = panel.characters_present
    .map((name) => {
      const char = characters.get(name);
      if (!char) return '';
      const appearance = char.promptPrefix || char.appearance;
      const isMale = !appearance.includes('1girl') && !appearance.includes('woman');
      const genderTag = isMale ? 'MALE' : 'FEMALE';
      const emotion = panel.character_emotions?.[name] || 'neutral';
      const action = panel.character_actions?.[name] || 'standing';

      // 감정을 시각적 묘사로 변환
      const emotionVisual = expandEmotion(emotion);
      // 행동을 구체적 신체 묘사로 변환
      const actionVisual = expandAction(action);

      return `[${name}] ${genderTag}. ${appearance}.
FACE/EYES: ${emotionVisual}
BODY/POSE: ${actionVisual}
CRITICAL: EXACT same face, hairstyle, hair color, clothing as reference sheet. Do NOT change any feature.`;
    })
    .filter(Boolean)
    .join('\n\n');

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
