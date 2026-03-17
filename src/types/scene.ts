export interface CharacterData {
  name: string;
  appearance: string;
  description_ko?: string;
  personality: string;
  age_range: string;
  promptPrefix?: string;
  referenceSheet?: string;
}

export interface LocationData {
  name: string;
  description: string; // 영어 태그 (이미지 생성용)
  description_ko?: string;
}

export interface DialogueData {
  speaker: string;
  text: string;
  type: 'speech' | 'thought' | 'narration' | 'sfx';
  positionX?: number;
  positionY?: number;
}

export interface PanelData {
  order: number;
  scene_description: string;
  location?: string; // location name 참조
  setting: string;
  mood: string;
  characters_present: string[];
  character_emotions: Record<string, string>;
  character_actions: Record<string, string>;
  camera_angle: string;
  dialogues: DialogueData[];
}

export interface AnalysisResult {
  title: string;
  summary: string;
  locations: LocationData[];
  characters: CharacterData[];
  panels: PanelData[];
}
