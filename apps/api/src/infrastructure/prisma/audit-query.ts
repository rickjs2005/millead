import type { Prisma } from "@millead/database";
import type { AuditFilters } from "../../domain/repositories/audit-repository.js";

/**
 * A listagem tem dois modos: agrupada (a última auditoria de cada empresa) e
 * histórico (todas as auditorias de UMA empresa). Escolher uma empresa é o
 * que troca de modo -- por isso `companyId` vence `latestPerCompany`.
 */
export function groupsByCompany(filters: AuditFilters): boolean {
  return !!filters.latestPerCompany && !filters.companyId;
}

/**
 * WHERE compartilhado pelos dois modos. `latestPerCompany` não entra aqui de
 * propósito: agrupar não é filtrar linha, é escolher UMA linha por empresa --
 * isso vive no DISTINCT ON do repositório.
 */
export function buildAuditWhere(
  organizationId: string,
  filters: AuditFilters,
): Prisma.AuditWhereInput {
  return {
    organizationId,
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
}
