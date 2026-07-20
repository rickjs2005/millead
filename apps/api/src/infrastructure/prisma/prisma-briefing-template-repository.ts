import { prisma } from "@millead/database";
import type {
  BriefingTemplate,
  BriefingTemplateDetail,
} from "../../domain/entities/briefing.js";
import type {
  BriefingTemplateRepository,
  CreateCustomTemplateInput,
} from "../../domain/repositories/briefing-template-repository.js";
import { templateInclude, toTemplateDetail } from "./briefing-mappers.js";

export class PrismaBriefingTemplateRepository implements BriefingTemplateRepository {
  async list(): Promise<BriefingTemplate[]> {
    return prisma.briefingTemplate.findMany({
      // CUSTOM fica fora do catálogo: é um formulário de UM envio, não um
      // tipo reutilizável que deva aparecer na escolha de template.
      where: { isActive: true, kind: { not: "CUSTOM" } },
      orderBy: { createdAt: "asc" },
    });
  }

  async createCustom(input: CreateCustomTemplateInput): Promise<BriefingTemplateDetail> {
    const row = await prisma.briefingTemplate.create({
      data: {
        organizationId: input.organizationId,
        key: input.key,
        kind: "CUSTOM",
        name: input.name,
        description: input.description ?? null,
        sections: {
          create: input.sections.map((section) => ({
            key: section.key,
            title: section.title,
            description: section.description ?? null,
            order: section.order,
            fields: {
              create: section.fields.map((field) => ({
                key: field.key,
                label: field.label,
                type: field.type,
                order: field.order,
                required: field.required,
                helpText: field.helpText ?? null,
                config: field.config === undefined ? undefined : (field.config as object),
              })),
            },
          })),
        },
      },
      include: templateInclude,
    });
    return toTemplateDetail(row);
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
