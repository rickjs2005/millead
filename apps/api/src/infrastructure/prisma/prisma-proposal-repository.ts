import { prisma, Prisma } from "@millead/database";
import type { Proposal } from "../../domain/entities/proposal.js";
import type {
  CreateProposalInput,
  ProposalFilters,
  ProposalRepository,
  UpdateProposalInput,
} from "../../domain/repositories/proposal-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

interface ProposalRow {
  id: string;
  organizationId: string;
  leadId: string;
  createdById: string | null;
  title: string;
  status: Proposal["status"];
  value: Prisma.Decimal;
  currency: string;
  validUntil: Date | null;
  pdfUrl: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDomain(row: ProposalRow): Proposal {
  return { ...row, value: row.value.toString() };
}

export class PrismaProposalRepository implements ProposalRepository {
  async create(input: CreateProposalInput): Promise<Proposal> {
    const row = await prisma.proposal.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        createdById: input.createdById ?? null,
        title: input.title,
        value: input.value,
        currency: input.currency,
        validUntil: input.validUntil ?? null,
        pdfUrl: input.pdfUrl ?? null,
      },
    });
    return toDomain(row);
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<Proposal | null> {
    const row = await prisma.proposal.findFirst({ where: { id, organizationId } });
    return row ? toDomain(row) : null;
  }

  async list(
    organizationId: string,
    filters: ProposalFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Proposal>> {
    const where: Prisma.ProposalWhereInput = {
      organizationId,
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.proposal.count({ where }),
    ]);
    return paginate(rows.map(toDomain), total, pagination);
  }

  async update(
    id: string,
    organizationId: string,
    patch: UpdateProposalInput,
  ): Promise<Proposal | null> {
    const { count } = await prisma.proposal.updateMany({
      where: { id, organizationId },
      data: patch,
    });
    if (count === 0) return null;
    const row = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    return toDomain(row);
  }
}
