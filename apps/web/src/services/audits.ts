import { api } from "./api-client";
import type { Audit, AuditStatus, PaginatedResult } from "@/types/api";

export interface ListAuditsParams {
  page?: number;
  pageSize?: number;
  companyId?: string;
  status?: AuditStatus;
}

export const auditsService = {
  list: (params: ListAuditsParams = {}) =>
    api.get<PaginatedResult<Audit>>("/api/v1/audits", params),

  get: (id: string) => api.get<Audit>(`/api/v1/audits/${id}`),

  /** Responde 202: a auditoria volta QUEUED e o worker processa em segundo plano. */
  create: (companyId: string) => api.post<Audit>("/api/v1/audits", { companyId }),
};
