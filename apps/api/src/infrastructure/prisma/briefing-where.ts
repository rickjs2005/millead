import type { Prisma } from "@millead/database";
import type { BriefingFilters } from "../../domain/repositories/briefing-repository.js";

/**
 * Monta o WHERE da listagem de briefings. Extraído do repositório pra poder
 * ser testado sem banco -- é aqui que mora a regra de visibilidade.
 *
 * Arquivado só aparece quando é pedido explicitamente: sem filtro de status,
 * a listagem esconde `ARCHIVED`. A regra vive no WHERE (e não numa filtragem
 * do array depois) porque o `count` da paginação usa o mesmo objeto -- filtrar
 * no cliente deixaria o total mentindo.
 */
export function buildBriefingWhere(
  organizationId: string,
  filters: BriefingFilters,
): Prisma.BriefingWhereInput {
  return {
    organizationId,
    status: filters.status ?? { not: "ARCHIVED" },
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
}
