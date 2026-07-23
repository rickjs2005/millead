import { prisma, Prisma, type BriefingStatus } from "@millead/database";
import type {
  Briefing,
  BriefingDetail,
  BriefingLink,
  BriefingTemplateDetail,
} from "../../domain/entities/briefing.js";
import type {
  BriefingFilters,
  BriefingRepository,
  CreateBriefingInput,
  UpdateContactInput,
} from "../../domain/repositories/briefing-repository.js";
import type { BriefingTemplateRepository } from "../../domain/repositories/briefing-template-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

const baseSelect = {
  id: true,
  organizationId: true,
  templateId: true,
  leadId: true,
  companyId: true,
  createdById: true,
  status: true,
  progressPercent: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  pdfUrl: true,
  startedAt: true,
  completedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Validade do link público: 24h após a criação (decisão de produto --
 * o link circula por WhatsApp; expirar limita o estrago de um encaminhamento).
 * Pra reabrir depois disso o admin usa "Duplicar" (gera link novo). */
const LINK_TTL_MS = 24 * 60 * 60 * 1000;

/** Sem o `template` aqui de propósito -- ver `PrismaBriefingRepository`:
 * a estrutura do template (seções->campos) é resolvida à parte, via
 * `templateRepository.findById`, que fica cacheado em memória (5min) por
 * `CachedBriefingTemplateRepository`. Isso tira do caminho quente do
 * formulário público (getByToken e CADA autosave) uma consulta aninhada
 * que hoje roda de novo a cada request mesmo quando o template não mudou. */
const detailInclude = {
  link: true,
  answers: true,
  files: { orderBy: { createdAt: "asc" as const } },
  history: { orderBy: { createdAt: "desc" as const }, take: 100 },
};

function toDomain(row: Briefing): Briefing {
  return row;
}

function toDetail(
  row: {
    link: BriefingLink | null;
    answers: BriefingDetail["answers"];
    files: BriefingDetail["files"];
    history: BriefingDetail["history"];
  } & Briefing,
  template: BriefingTemplateDetail,
): BriefingDetail {
  const { link, answers, files, history, ...briefing } = row;
  return {
    ...briefing,
    template,
    link,
    answers,
    files,
    history,
  };
}

export class PrismaBriefingRepository implements BriefingRepository {
  constructor(private readonly templateRepository: BriefingTemplateRepository) {}

  /** Resolve o template do briefing (cacheado) -- lança se a FK estiver
   * quebrada, o que a constraint do banco (onDelete: Restrict) já impede
   * de acontecer em uso normal. */
  private async resolveTemplate(templateId: string): Promise<BriefingTemplateDetail> {
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error(`BriefingTemplate ${templateId} não encontrado (FK deveria impedir isso)`);
    }
    return template;
  }

  async create(input: CreateBriefingInput): Promise<Briefing & { link: BriefingLink }> {
    const result = await prisma.$transaction(async (tx) => {
      const briefing = await tx.briefing.create({
        data: {
          organizationId: input.organizationId,
          templateId: input.templateId,
          leadId: input.leadId ?? null,
          companyId: input.companyId ?? null,
          createdById: input.createdById ?? null,
        },
        select: baseSelect,
      });
      const link = await tx.briefingLink.create({
        data: {
          organizationId: input.organizationId,
          briefingId: briefing.id,
          token: input.token,
          expiresAt: new Date(Date.now() + LINK_TTL_MS),
        },
      });
      await tx.briefingHistory.create({
        data: {
          organizationId: input.organizationId,
          briefingId: briefing.id,
          tipo: "CRIADO",
          origem: "APP",
        },
      });
      return { briefing, link };
    });
    return { ...toDomain(result.briefing), link: result.link };
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<BriefingDetail | null> {
    const row = await prisma.briefing.findFirst({
      where: { id, organizationId },
      include: detailInclude,
    });
    if (!row) return null;
    return toDetail(row, await this.resolveTemplate(row.templateId));
  }

  async findByToken(token: string): Promise<BriefingDetail | null> {
    const row = await prisma.briefing.findFirst({
      where: {
        link: {
          token,
          revokedAt: null,
          // expiresAt null = link antigo (antes da regra de 24h), segue válido.
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      },
      include: detailInclude,
    });
    if (!row) return null;
    return toDetail(row, await this.resolveTemplate(row.templateId));
  }

  async list(
    organizationId: string,
    filters: BriefingFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Briefing>> {
    const where: Prisma.BriefingWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.search
        ? {
            OR: [
              { contactName: { contains: filters.search, mode: "insensitive" } },
              { contactEmail: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.briefing.findMany({
        where,
        // kind do template embutido: o catálogo (listTemplates) exclui CUSTOM
        // de propósito, então a lista admin precisa dele vindo daqui.
        select: { ...baseSelect, template: { select: { kind: true } } },
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.briefing.count({ where }),
    ]);
    const items = rows.map(({ template, ...row }) => ({
      ...toDomain(row),
      templateKind: template.kind,
    }));
    return paginate(items, total, pagination);
  }

  async updateStatus(
    id: string,
    status: BriefingStatus,
    extra?: { startedAt?: Date; completedAt?: Date; archivedAt?: Date },
  ): Promise<Briefing | null> {
    const { count } = await prisma.briefing.updateMany({
      where: { id },
      data: { status, ...extra },
    });
    if (count === 0) return null;
    const row = await prisma.briefing.findUniqueOrThrow({ where: { id }, select: baseSelect });
    return toDomain(row);
  }

  async markCompleted(id: string, completedAt: Date): Promise<Briefing | null> {
    // condição no WHERE = compare-and-set: duas chamadas concorrentes de
    // `complete` só têm uma com count === 1; a outra sai com null.
    const { count } = await prisma.briefing.updateMany({
      where: { id, status: { notIn: ["COMPLETED", "ARCHIVED"] } },
      data: { status: "COMPLETED", completedAt },
    });
    if (count === 0) return null;
    const row = await prisma.briefing.findUniqueOrThrow({ where: { id }, select: baseSelect });
    return toDomain(row);
  }

  async linkCompany(id: string, companyId: string): Promise<void> {
    await prisma.briefing.update({ where: { id }, data: { companyId } });
  }

  async updateProgress(id: string, progressPercent: number): Promise<void> {
    await prisma.briefing.update({ where: { id }, data: { progressPercent } });
  }

  async updateContact(id: string, contact: UpdateContactInput): Promise<void> {
    await prisma.briefing.update({ where: { id }, data: contact });
  }

  async setPdfUrl(id: string, pdfUrl: string): Promise<void> {
    await prisma.briefing.update({ where: { id }, data: { pdfUrl } });
  }

  async duplicate(
    id: string,
    organizationId: string,
    createdById: string | null,
    token: string,
  ): Promise<Briefing & { link: BriefingLink }> {
    const original = await prisma.briefing.findFirstOrThrow({
      where: { id, organizationId },
      select: { templateId: true, leadId: true, companyId: true },
    });
    return this.create({
      organizationId,
      templateId: original.templateId,
      leadId: original.leadId,
      companyId: original.companyId,
      createdById,
      token,
    });
  }

  async revokeLink(briefingId: string, organizationId: string): Promise<void> {
    await prisma.briefingLink.updateMany({
      where: { briefingId, organizationId },
      data: { revokedAt: new Date() },
    });
  }

  async addHistory(
    briefingId: string,
    organizationId: string,
    tipo: string,
    origem: "APP" | "PUBLIC_FORM" | "WORKER",
    payload?: unknown,
  ): Promise<void> {
    await prisma.briefingHistory.create({
      data: {
        organizationId,
        briefingId,
        tipo,
        origem,
        payload: payload === undefined ? Prisma.JsonNull : (payload as Prisma.InputJsonValue),
      },
    });
  }
}
