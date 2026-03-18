export interface StylePreset {
  key: string;
  label: string;        // 한글 이름
  emoji: string;
  desc: string;         // 한글 설명
  stylePrompt: string;  // Gemini에 들어가는 영문 스타일 지시
  colorTone: string;    // 색감 힌트
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    key: 'drama',
    label: '드라마',
    emoji: '🎭',
    desc: '외모지상주의·약한영웅 느낌의 깔끔한 현실 드라마',
    stylePrompt: 'Premium Korean webtoon style. Clean thin outlines, semi-realistic proportions (tall, slim figures with 8-head ratio). Detailed eyes with 2-3 highlight dots. Smooth gradient cel-shading, no harsh shadows. Modern Korean fashion (neat hair, fitted clothes). Backgrounds: clean urban environments with soft depth-of-field blur. Emotionally nuanced faces — subtle micro-expressions over exaggerated ones.',
    colorTone: 'clean natural tones, soft warm lighting, slight desaturation for realism',
  },
  {
    key: 'action',
    label: '액션',
    emoji: '⚔️',
    desc: '솔로레벨링·전독시 스타일의 강렬한 다크 액션',
    stylePrompt: 'Dark action manhwa style. Bold line weight (thick outlines on characters, thin on details). High-contrast dramatic lighting with rim-light effects. Sharp jaw lines, intense narrow eyes. Dynamic foreshortening and speed lines. Dark cinematic atmosphere with volumetric light beams. Muscular detailed anatomy. Backgrounds: dramatic perspective, destroyed environments, rain/dust particles.',
    colorTone: 'deep dark blues and purples, stark white highlights, selective orange/red accents on key moments',
  },
  {
    key: 'romance',
    label: '로맨스',
    emoji: '💕',
    desc: '여신강림·트루뷰티 느낌의 감성적이고 예쁜 로맨스',
    stylePrompt: 'Soft Korean romance webtoon style. Thin delicate lineart with rounded edges. Large sparkly eyes with multiple star-shaped highlights and long lashes. Soft airbrush shading, no hard edges. Rosy cheeks on emotional moments. Characters are beautiful/handsome with perfect skin. Floral/sparkle overlay effects on romantic scenes. Backgrounds: soft bokeh, warm cafe interiors, cherry blossoms, sunset skies.',
    colorTone: 'warm pink and peach tones, soft golden hour lighting, pastel lavender accents, everything slightly glowy',
  },
  {
    key: 'thriller',
    label: '스릴러',
    emoji: '🔪',
    desc: '바스타드·스위트홈 느낌의 어둡고 섬뜩한 심리 스릴러',
    stylePrompt: 'Psychological thriller manhwa style. Sketchy rough lineart that gets messier in tense scenes. Heavy crosshatching shadows on faces. Extreme close-ups of eyes with dilated pupils. Distorted dutch-angle perspectives. Faces half-hidden in shadow. Grainy film texture overlay. Backgrounds: claustrophobic tight spaces, long empty corridors, flickering fluorescent light.',
    colorTone: 'almost monochrome grey, desaturated sickly green undertone, blood-red as only saturated accent color',
  },
  {
    key: 'fantasy',
    label: '판타지',
    emoji: '🐉',
    desc: '나혼렙·신의 탑 스타일의 웅장한 하이 판타지',
    stylePrompt: 'Epic fantasy manhwa style. Detailed ornate lineart. Characters wearing elaborate armor/robes with intricate patterns. Glowing magical aura effects around hands/weapons. Grand scale architecture (massive castles, floating islands). Detailed fantasy creatures. Rich painterly shading with visible brushstrokes on backgrounds. Characters have distinctive fantasy features (unusual eye colors, scars, markings).',
    colorTone: 'rich jewel tones — deep sapphire blue, emerald green, amethyst purple. Gold metallic accents. Magical cyan/white glow effects',
  },
  {
    key: 'romance_fantasy',
    label: '로판',
    emoji: '👑',
    desc: '재혼황후·어떤 공녀 스타일의 우아한 궁정 로맨스',
    stylePrompt: 'Elegant romance fantasy manhwa style. Extremely detailed character designs — elaborate Victorian/medieval dresses with lace, jewels, flowing fabric. Long flowing hair with individual strand details. Large luminous eyes. Ornate palace interiors with chandeliers, marble floors, rose gardens. Soft ethereal lighting through tall windows. Characters look aristocratic and regal.',
    colorTone: 'warm ivory and champagne gold, rose pink accents, soft candlelight amber, luxurious deep burgundy',
  },
  {
    key: 'comedy',
    label: '일상',
    emoji: '😆',
    desc: '유미의 세포들·마음의 소리 느낌의 귀엽고 재밌는 일상',
    stylePrompt: 'Cute Korean daily-life webtoon style. Simple clean lineart with uniform line weight. Round soft character proportions (slightly chibi, big head ratio 1:5). Exaggerated emoji-like expressions for comedy (steam from head, sweat drops, sparkle eyes). Flat bright coloring with minimal shading. Simple clean backgrounds with occasional pattern fills. Characters wear casual everyday Korean fashion.',
    colorTone: 'bright cheerful primary colors, white clean backgrounds, pop color accents',
  },
  {
    key: 'cinematic',
    label: '시네마',
    emoji: '🎬',
    desc: '영화 같은 연출. 조명과 구도가 강조된 프리미엄 스타일',
    stylePrompt: 'Cinematic premium illustration style. Painterly rendering with visible brushwork. Dramatic film-like lighting (strong key light, colored fill light, rim light). Wide 16:9 feeling compositions. Shallow depth of field with bokeh backgrounds. Realistic proportions and anatomy. Muted sophisticated color grading like a Korean film. Atmospheric haze and volumetric lighting.',
    colorTone: 'muted film-graded tones, teal and orange color grading, atmospheric fog, sophisticated and moody',
  },
];

export const DEFAULT_STYLE = 'drama';

export function getStylePreset(key: string): StylePreset {
  return STYLE_PRESETS.find(s => s.key === key) ?? STYLE_PRESETS[0];
}
