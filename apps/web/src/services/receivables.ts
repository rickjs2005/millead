import { api } from "./api-client";
import type {
  ContractMargin,
  ContractWithTotals,
  CreatePlanPayload,
  PayReceivablePayload,
  Receivable,
  ReceivableSeries,
  ReceivableSummary,
  UpdateReceivablePayload,
} from "@/types/api";

export const receivablesService = {
  createPlan: (payload: CreatePlanPayload) =>
    api.post<Receivable[]>("/api/v1/receivables/plan", payload),

  listByContract: (contractId: string) =>
    api.get<Receivable[]>("/api/v1/receivables", { contractId }),

  listContracts: () => api.get<ContractWithTotals[]>("/api/v1/receivables"),

  summary: (month?: string) =>
    api.get<ReceivableSummary>("/api/v1/receivables/summary", month ? { month } : undefined),

  series: (months?: number) =>
    api.get<ReceivableSeries>(
      "/api/v1/receivables/summary/series",
      months ? { months } : undefined,
    ),

  margin: (contractId: string) =>
    api.get<ContractMargin>("/api/v1/receivables/margin", { contractId }),

  pay: (id: string, payload: PayReceivablePayload) =>
    api.patch<Receivable>(`/api/v1/receivables/${id}/pay`, payload),

  unpay: (id: string) => api.patch<Receivable>(`/api/v1/receivables/${id}/unpay`),

  update: (id: string, payload: UpdateReceivablePayload) =>
    api.patch<Receivable>(`/api/v1/receivables/${id}`, payload),

  remove: (id: string) => api.delete<void>(`/api/v1/receivables/${id}`),
};
