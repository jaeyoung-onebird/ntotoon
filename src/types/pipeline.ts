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
}

export interface PipelineJobData {
  projectId: string;
  episodeId?: string;
}
