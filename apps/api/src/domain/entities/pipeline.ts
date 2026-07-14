export interface PipelineStage {
  id: string;
  organizationId: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  createdAt: Date;
}

export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}
