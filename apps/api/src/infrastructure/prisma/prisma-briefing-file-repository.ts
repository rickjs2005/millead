import { prisma } from "@millead/database";
import type { BriefingFile } from "../../domain/entities/briefing.js";
import type {
  BriefingFileRepository,
  CreateBriefingFileInput,
} from "../../domain/repositories/briefing-file-repository.js";

export class PrismaBriefingFileRepository implements BriefingFileRepository {
  async create(input: CreateBriefingFileInput): Promise<BriefingFile> {
    return prisma.briefingFile.create({ data: input });
  }

  async listForBriefing(briefingId: string, organizationId: string): Promise<BriefingFile[]> {
    return prisma.briefingFile.findMany({
      where: { briefingId, organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string, organizationId: string): Promise<BriefingFile | null> {
    return prisma.briefingFile.findFirst({ where: { id, organizationId } });
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await prisma.briefingFile.deleteMany({ where: { id, organizationId } });
  }
}
