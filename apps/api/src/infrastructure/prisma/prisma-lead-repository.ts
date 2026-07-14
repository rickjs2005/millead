import { prisma, Prisma } from "@millead/database";
import type { Lead, LeadDetail } from "../../domain/entities/lead.js";
import type {
  CreateLeadInput,
  LeadFilters,
  LeadRepository,
  MoveStageInput,
  UpdateLeadInput,
} from "../../domain/repositories/lead-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

interface LeadRow {
  id: string;
  organizationId: string;
  companyId: string | null;
  pipelineStageId: string | null;
  ownerId: string | null;
  title: string;
  source: Lead["source"];
  status: Lead["status"];
  score: number | null;
  value: Prisma.Decimal | null;
  currency: string;
  lostReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDomainLead(row: LeadRow): Lead {
  return { ...row, value: row.value ? row.value.toString() : null };
}

const withDetail = {
  contacts: { orderBy: { createdAt: "asc" as const } },
  notes: { orderBy: { createdAt: "desc" as const } },
  tags: { include: { tag: true } },
};

export class PrismaLeadRepository implements LeadRepository {
  async create(input: CreateLeadInput): Promise<Lead> {
    const row = await prisma.lead.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId ?? null,
        pipelineStageId: input.pipelineStageId ?? null,
        ownerId: input.ownerId ?? null,
        title: input.title,
        source: input.source,
        value: input.value ?? undefined,
        currency: input.currency,
      },
    });
    return toDomainLead(row);
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<LeadDetail | null> {
    const row = await prisma.lead.findFirst({
      where: { id, organizationId },
      include: withDetail,
    });
    if (!row) return null;
    const { contacts, notes, tags, ...lead } = row;
    return {
      ...toDomainLead(lead),
      contacts,
      notes,
      tags: tags.map((t) => ({ id: t.tag.id, name: t.tag.name, color: t.tag.color })),
    };
  }

  async list(
    organizationId: string,
    filters: LeadFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Lead>> {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.pipelineStageId ? { pipelineStageId: filters.pipelineStageId } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.search ? { title: { contains: filters.search, mode: "insensitive" } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(pagination) }),
      prisma.lead.count({ where }),
    ]);
    return paginate(rows.map(toDomainLead), total, pagination);
  }

  async update(id: string, organizationId: string, patch: UpdateLeadInput): Promise<Lead | null> {
    const { count } = await prisma.lead.updateMany({ where: { id, organizationId }, data: patch });
    if (count === 0) return null;
    const row = await prisma.lead.findUniqueOrThrow({ where: { id } });
    return toDomainLead(row);
  }

  async updateScore(id: string, organizationId: string, score: number): Promise<Lead | null> {
    const { count } = await prisma.lead.updateMany({
      where: { id, organizationId },
      data: { score },
    });
    if (count === 0) return null;
    const row = await prisma.lead.findUniqueOrThrow({ where: { id } });
    return toDomainLead(row);
  }

  async moveStage(id: string, organizationId: string, input: MoveStageInput): Promise<Lead | null> {
    const { count } = await prisma.lead.updateMany({
      where: { id, organizationId },
      data: {
        pipelineStageId: input.pipelineStageId,
        status: input.status,
        closedAt: input.closedAt,
      },
    });
    if (count === 0) return null;
    const row = await prisma.lead.findUniqueOrThrow({ where: { id } });
    return toDomainLead(row);
  }

  async addContact(
    leadId: string,
    organizationId: string,
    input: { name: string; role?: string; email?: string; phone?: string; isPrimary?: boolean },
  ) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return null;
    return prisma.leadContact.create({
      data: {
        organizationId,
        leadId,
        name: input.name,
        role: input.role,
        email: input.email,
        phone: input.phone,
        isPrimary: input.isPrimary ?? false,
      },
    });
  }

  async removeContact(id: string, leadId: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.leadContact.deleteMany({
      where: { id, leadId, organizationId },
    });
    return count > 0;
  }

  async addNote(leadId: string, organizationId: string, authorId: string | null, body: string) {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return null;
    return prisma.leadNote.create({ data: { organizationId, leadId, authorId, body } });
  }

  async addTag(leadId: string, tagId: string, organizationId: string): Promise<boolean> {
    const [lead, tag] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, organizationId } }),
      prisma.tag.findFirst({ where: { id: tagId, organizationId } }),
    ]);
    if (!lead || !tag) return false;
    await prisma.leadTag.upsert({
      where: { leadId_tagId: { leadId, tagId } },
      create: { leadId, tagId },
      update: {},
    });
    return true;
  }

  async removeTag(leadId: string, tagId: string, organizationId: string): Promise<boolean> {
    const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
    if (!lead) return false;
    await prisma.leadTag.deleteMany({ where: { leadId, tagId } });
    return true;
  }
}
