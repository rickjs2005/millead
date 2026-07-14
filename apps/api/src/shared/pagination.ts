/**
 * Tipos neutros de paginação -- vivem fora de domain/application/
 * infrastructure/interfaces de propósito, porque tanto `domain` (contratos
 * de repositório) quanto `application` (DTOs/use-cases) precisam deles, e
 * `domain` não pode depender de `application` (regra de dependência da
 * Clean Architecture, ver docs/ARCHITECTURE.md).
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(
  items: T[],
  total: number,
  params: PaginationParams,
): PaginatedResult<T> {
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

export function toSkipTake(params: PaginationParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.pageSize, take: params.pageSize };
}
