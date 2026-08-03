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
  publicToken: string | null;
  viewedAt: Date | null;
  decidedAt: Date | null;
  decisionIp: string | null;
  rejectReason: string | null;
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
    opts?: { requireNotDecided?: boolean },
  ): Promise<Proposal | null> {
    // requireNotDecided: mesmo CAS que `decide()` já usa pro caminho público
    // -- garante que uma decisão manual (ACCEPTED/REJECTED) não sobrescreva
    // silenciosamente uma decisão que o cliente já tomou pelo link público
    // entre a checagem em ProposalService.update() e esta escrita.
    const where: Prisma.ProposalWhereInput = { id, organizationId };
    if (opts?.requireNotDecided) {
      where.decidedAt = null;
    }
    const { count } = await prisma.proposal.updateMany({ where, data: patch });
    if (count === 0) return null;
    const row = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    return toDomain(row);
  }

  async ensurePublicToken(
    id: string,
    organizationId: string,
    token: string,
  ): Promise<string | null> {
    // CAS: só grava se publicToken ainda for null -- em corrida entre duas
    // transições SENT concorrentes, updateMany com esse where garante que
    // só a primeira escreve; a segunda vira no-op e o findFirst abaixo lê
    // o token do vencedor (que pode ser o desta própria chamada).
    await prisma.proposal.updateMany({
      where: { id, organizationId, publicToken: null },
      data: { publicToken: token },
    });
    const row = await prisma.proposal.findFirst({
      where: { id, organizationId },
      select: { publicToken: true },
    });
    return row?.publicToken ?? null;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.proposal.deleteMany({ where: { id, organizationId } });
    return count > 0;
  }

  async findByPublicToken(token: string): Promise<Proposal | null> {
    // DRAFT nunca tem publicToken gravado (só ensurePublicToken grava, e só
    // na transição pra SENT), mas o filtro explícito documenta a garantia:
    // token de proposta ainda não enviada nunca é um 200 aqui.
    const row = await prisma.proposal.findFirst({
      where: { publicToken: token, status: { not: "DRAFT" } },
    });
    return row ? toDomain(row) : null;
  }

  async markViewed(id: string, viewedAt: Date): Promise<boolean> {
    const { count } = await prisma.proposal.updateMany({
      where: { id, status: "SENT" },
      data: { status: "VIEWED", viewedAt },
    });
    return count > 0;
  }

  async decide(
    id: string,
    decision: "ACCEPTED" | "REJECTED",
    data: { decidedAt: Date; decisionIp: string | null; rejectReason?: string },
  ): Promise<Proposal | null> {
    const { count } = await prisma.proposal.updateMany({
      where: { id, status: { in: ["SENT", "VIEWED"] } },
      data: {
        status: decision,
        decidedAt: data.decidedAt,
        decisionIp: data.decisionIp,
        respondedAt: data.decidedAt,
        ...(decision === "REJECTED" ? { rejectReason: data.rejectReason ?? null } : {}),
      },
    });
    if (count === 0) return null;
    const row = await prisma.proposal.findUniqueOrThrow({ where: { id } });
    return toDomain(row);
  }

  async markExpired(id: string): Promise<void> {
    await prisma.proposal.updateMany({
      where: { id, status: { in: ["SENT", "VIEWED"] } },
      data: { status: "EXPIRED" },
    });
  }
}
