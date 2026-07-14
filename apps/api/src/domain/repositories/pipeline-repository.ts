import type { Pipeline, PipelineStage, PipelineWithStages } from "../entities/pipeline.js";

export interface PipelineRepository {
  listForOrg(organizationId: string): Promise<PipelineWithStages[]>;
  findByIdForOrg(id: string, organizationId: string): Promise<PipelineWithStages | null>;
  /** Primeiro estágio (menor `order`) do pipeline padrão da organização -- usado ao criar um lead sem estágio explícito. */
  findDefaultFirstStage(organizationId: string): Promise<PipelineStage | null>;
  findStageForOrg(stageId: string, organizationId: string): Promise<PipelineStage | null>;
  create(organizationId: string, name: string, isDefault?: boolean): Promise<Pipeline>;
  addStage(
    pipelineId: string,
    organizationId: string,
    input: { name: string; order: number; color?: string; isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage | null>;
}
