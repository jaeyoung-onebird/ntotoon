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
    desc: '현실적인 일상 드라마. 룩이즘/약한영웅 스타일.',
    stylePrompt: 'Korean drama manhwa style like Lookism or Weak Hero. Clean black outlines, cel-shading, natural colors, realistic proportions, emotionally expressive faces. Slice-of-life urban setting.',
    colorTone: 'natural, balanced, slightly warm',
  },
  {
    key: 'action',
    label: '액션',
    emoji: '⚔️',
    desc: '강렬한 액션. 솔로레벨링 스타일의 다크한 색감.',
    stylePrompt: 'Korean action manhwa style like Solo Leveling or The God of High School. Bold thick outlines, dramatic shadows, high contrast lighting, intense expressions, dynamic poses, dark and cinematic color palette.',
    colorTone: 'dark, high contrast, cinematic, blue/purple tones',
  },
  {
    key: 'romance',
    label: '로맨스',
    emoji: '💕',
    desc: '부드럽고 감성적인 로맨스. 트루뷰티 스타일.',
    stylePrompt: 'Korean romance manhwa style like True Beauty or My ID is Gangnam Beauty. Soft rounded lineart, pastel color palette, sparkly eyes with detailed highlights, gentle shading, dreamy atmosphere, beautiful character designs.',
    colorTone: 'soft pastel, pink and lavender tones, warm and bright',
  },
  {
    key: 'thriller',
    label: '스릴러',
    emoji: '😱',
    desc: '긴장감 넘치는 스릴러. 어두운 색감과 날카로운 선.',
    stylePrompt: 'Korean thriller manhwa style like Bastard or Sweet Home. Sharp angular lineart, heavy shadows, dark noir atmosphere, desaturated colors with selective color highlights, unsettling compositions, psychological tension.',
    colorTone: 'desaturated, dark, grey and black tones with red accents',
  },
  {
    key: 'fantasy',
    label: '판타지',
    emoji: '🧙',
    desc: '웅장한 판타지. 화려한 배경과 마법 이펙트.',
    stylePrompt: 'Korean fantasy manhwa style like Tower of God or The Beginning After the End. Detailed elaborate backgrounds, magical effects and glow, ornate character designs, rich saturated colors, epic scale compositions, intricate world-building.',
    colorTone: 'rich saturated, jewel tones, magical glows, purple and gold',
  },
  {
    key: 'romance_fantasy',
    label: '로판',
    emoji: '👑',
    desc: '로맨스 판타지. 화려한 귀족/왕실 배경에 로맨스.',
    stylePrompt: 'Korean romance fantasy manhwa style like Remarried Empress or Who Made Me a Princess. Elegant character designs with elaborate costumes, opulent aristocratic settings, soft but detailed artwork, warm golden lighting, regal and romantic atmosphere.',
    colorTone: 'warm gold and ivory, soft romantic lighting, elegant',
  },
  {
    key: 'comedy',
    label: '개그',
    emoji: '😂',
    desc: '과장된 표정과 코믹한 연출.',
    stylePrompt: 'Korean comedy manhwa style. Exaggerated facial expressions, chibi/super-deformed moments, bright vivid colors, bouncy energetic compositions, comedic timing through panel layouts, fun and lighthearted atmosphere.',
    colorTone: 'bright vivid, cheerful, saturated primary colors',
  },
  {
    key: 'scifi',
    label: 'SF',
    emoji: '🚀',
    desc: '미래지향적인 SF. 사이버펑크 혹은 스페이스오페라.',
    stylePrompt: 'Korean sci-fi manhwa style. Sleek futuristic character designs, technological environments, neon lighting effects, clean precise lineart, cyberpunk or space opera atmosphere, holographic UI elements described visually.',
    colorTone: 'neon blue and cyan, dark backgrounds with bright accents, electric',
  },
];

export const DEFAULT_STYLE = 'drama';

export function getStylePreset(key: string): StylePreset {
  return STYLE_PRESETS.find(s => s.key === key) ?? STYLE_PRESETS[0];
}
