export type PipelineStep =
  | 'analyzing'
  | 'characters'
  | 'panels'
  | 'bubbles'
  | 'assembly'
  | 'complete'
  | 'failed';

export interface PipelineProgress {
  step: PipelineStep;
  progress: number; // 0-100
  message: string;
  outputUrl?: string;
  panelUrl?: string; // 패널 실시간 미리보기
  characterUrl?: string; // 캐릭터 시트 미리보기
}

export interface PipelineJobData {
  projectId: string;
  episodeId?: string;
}
