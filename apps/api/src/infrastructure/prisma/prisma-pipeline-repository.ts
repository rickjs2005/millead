import { prisma } from "@millead/database";
import type {
  Pipeline,
  PipelineStage,
  PipelineWithStages,
} from "../../domain/entities/pipeline.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";

const withStages = { stages: { orderBy: { order: "asc" as const } } };

export class PrismaPipelineRepository implements PipelineRepository {
  async listForOrg(organizationId: string): Promise<PipelineWithStages[]> {
    return prisma.pipeline.findMany({
      where: { organizationId },
      include: withStages,
      orderBy: { createdAt: "asc" },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<PipelineWithStages | null> {
    return prisma.pipeline.findFirst({ where: { id, organizationId }, include: withStages });
  }

  async findDefaultFirstStage(organizationId: string): Promise<PipelineStage | null> {
    return prisma.pipelineStage.findFirst({
      where: { organizationId, pipeline: { isDefault: true } },
      orderBy: { order: "asc" },
    });
  }

  async findStageForOrg(stageId: string, organizationId: string): Promise<PipelineStage | null> {
    return prisma.pipelineStage.findFirst({ where: { id: stageId, organizationId } });
  }

  async create(organizationId: string, name: string, isDefault = false): Promise<Pipeline> {
    return prisma.pipeline.create({ data: { organizationId, name, isDefault } });
  }

  async addStage(
    pipelineId: string,
    organizationId: string,
    input: { name: string; order: number; color?: string; isWon?: boolean; isLost?: boolean },
  ): Promise<PipelineStage | null> {
    const pipeline = await prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } });
    if (!pipeline) return null;
    return prisma.pipelineStage.create({
      data: {
        organizationId,
        pipelineId,
        name: input.name,
        order: input.order,
        color: input.color,
        isWon: input.isWon ?? false,
        isLost: input.isLost ?? false,
      },
    });
  }
}
