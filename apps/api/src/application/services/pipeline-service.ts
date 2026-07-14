import { NotFoundError } from "../../domain/errors/app-error.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";

export class PipelineService {
  constructor(private readonly repository: PipelineRepository) {}

  list(organizationId: string) {
    return this.repository.listForOrg(organizationId);
  }

  async get(organizationId: string, id: string) {
    const pipeline = await this.repository.findByIdForOrg(id, organizationId);
    if (!pipeline) throw new NotFoundError("Pipeline não encontrado.");
    return pipeline;
  }

  create(organizationId: string, name: string, isDefault?: boolean) {
    return this.repository.create(organizationId, name, isDefault);
  }

  async addStage(
    organizationId: string,
    pipelineId: string,
    input: { name: string; order: number; color?: string; isWon?: boolean; isLost?: boolean },
  ) {
    const stage = await this.repository.addStage(pipelineId, organizationId, input);
    if (!stage) throw new NotFoundError("Pipeline não encontrado.");
    return stage;
  }
}
