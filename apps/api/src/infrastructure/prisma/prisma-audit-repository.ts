import { prisma, Prisma } from "@millead/database";
import type { Audit, AuditWithResults } from "../../domain/entities/audit.js";
import type {
  AuditFilters,
  AuditRepository,
  AuditResultInput,
  CreateAuditInput,
} from "../../domain/repositories/audit-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

const withResults = { report: true, scores: true } as const;

export class PrismaAuditRepository implements AuditRepository {
  async create(input: CreateAuditInput): Promise<Audit> {
    return prisma.audit.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        requestedById: input.requestedById ?? null,
        triggeredBy: input.triggeredBy ?? "MANUAL",
      },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<AuditWithResults | null> {
    return prisma.audit.findFirst({
      where: { id, organizationId },
      include: withResults,
    });
  }

  async list(
    organizationId: string,
    filters: AuditFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<AuditWithResults>> {
    const where: Prisma.AuditWhereInput = {
      organizationId,
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.audit.findMany({
        where,
        include: withResults,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.audit.count({ where }),
    ]);
    return paginate(rows, total, pagination);
  }

  async markRunning(id: string): Promise<void> {
    await prisma.audit.update({
      where: { id },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  }

  async saveResult(id: string, result: AuditResultInput): Promise<void> {
    const audit = await prisma.audit.findUniqueOrThrow({
      where: { id },
      select: { organizationId: true },
    });
    await prisma.$transaction([
      prisma.audit.update({
        where: { id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
      prisma.auditReport.upsert({
        where: { auditId: id },
        create: {
          organizationId: audit.organizationId,
          auditId: id,
          summary: result.summary,
          rawData: result.rawData as Prisma.InputJsonValue,
        },
        update: {
          summary: result.summary,
          rawData: result.rawData as Prisma.InputJsonValue,
        },
      }),
      prisma.auditScore.deleteMany({ where: { auditId: id } }),
      prisma.auditScore.createMany({
        data: result.scores.map((s) => ({
          organizationId: audit.organizationId,
          auditId: id,
          category: s.category,
          score: s.score,
          details: (s.details ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        })),
      }),
    ]);
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const audit = await prisma.audit.findUniqueOrThrow({
      where: { id },
      select: { organizationId: true },
    });
    await prisma.$transaction([
      prisma.audit.update({
        where: { id },
        data: { status: "FAILED", completedAt: new Date() },
      }),
      prisma.auditReport.upsert({
        where: { auditId: id },
        create: { organizationId: audit.organizationId, auditId: id, summary: errorMessage },
        update: { summary: errorMessage },
      }),
    ]);
  }
}
