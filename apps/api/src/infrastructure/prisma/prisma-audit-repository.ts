import { prisma, Prisma } from "@millead/database";
import type { Audit, AuditWithResults } from "../../domain/entities/audit.js";
import type {
  AuditFilters,
  AuditRepository,
  AuditResultInput,
  CreateAuditInput,
} from "../../domain/repositories/audit-repository.js";
import { buildAuditWhere, groupsByCompany } from "./audit-query.js";
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
    const where = buildAuditWhere(organizationId, filters);

    if (groupsByCompany(filters)) {
      return this.listLatestPerCompany(organizationId, filters, pagination);
    }

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

  /**
   * Uma auditoria por empresa: a mais recente. Vai de SQL cru porque o
   * `distinct` do Prisma é resolvido EM MEMÓRIA -- medido: a query sai sem
   * `DISTINCT ON` e sem `LIMIT`, então ele puxaria a tabela toda e o `OFFSET`
   * da paginação rodaria antes da deduplicação, devolvendo páginas erradas.
   * `DISTINCT ON (company_id)` resolve no banco, e o total conta empresas
   * distintas -- senão o contador da paginação mentiria.
   */
  private async listLatestPerCompany(
    organizationId: string,
    filters: AuditFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<AuditWithResults>> {
    const statusFilter = filters.status
      ? Prisma.sql`AND "status" = ${filters.status}::"audit_status"`
      : Prisma.empty;
    const { skip, take } = toSkipTake(pagination);

    const [idRows, countRows] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM (
          SELECT DISTINCT ON ("company_id") "id", "created_at"
          FROM "audits"
          WHERE "organization_id" = ${organizationId} ${statusFilter}
          ORDER BY "company_id", "created_at" DESC
        ) AS latest
        ORDER BY "created_at" DESC
        LIMIT ${take} OFFSET ${skip}
      `,
      prisma.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(DISTINCT "company_id") AS total
        FROM "audits"
        WHERE "organization_id" = ${organizationId} ${statusFilter}
      `,
    ]);

    const ids = idRows.map((row) => row.id);
    const rows = ids.length
      ? await prisma.audit.findMany({
          where: { id: { in: ids } },
          include: withResults,
          orderBy: { createdAt: "desc" },
        })
      : [];

    return paginate(rows, Number(countRows[0]?.total ?? 0), pagination);
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
