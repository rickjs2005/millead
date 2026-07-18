import { prisma } from "@millead/database";
import type {
  BriefingTemplate,
  BriefingTemplateDetail,
} from "../../domain/entities/briefing.js";
import type { BriefingTemplateRepository } from "../../domain/repositories/briefing-template-repository.js";
import { templateInclude, toTemplateDetail } from "./briefing-mappers.js";

export class PrismaBriefingTemplateRepository implements BriefingTemplateRepository {
  async list(): Promise<BriefingTemplate[]> {
    return prisma.briefingTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findById(id: string): Promise<BriefingTemplateDetail | null> {
    const row = await prisma.briefingTemplate.findUnique({
      where: { id },
      include: templateInclude,
    });
    return row ? toTemplateDetail(row) : null;
  }

  async findByKey(key: string): Promise<BriefingTemplateDetail | null> {
    const row = await prisma.briefingTemplate.findUnique({
      where: { key },
      include: templateInclude,
    });
    return row ? toTemplateDetail(row) : null;
  }
}
