import { api } from "./api-client";
import type {
  BusinessExpense,
  BusinessExpenseSummary,
  CostServiceCatalogItem,
  CostSubscription,
  CostSubscriptionPayload,
  CostSummary,
  CostUsageEntry,
  CostUsageSeries,
  CreateUsageEntryPayload,
  FinanceSettings,
  FinanceSettingsPayload,
  UsageSummary,
} from "@/types/api";

export const costsService = {
  list: () => api.get<CostSubscription[]>("/api/v1/costs"),
  create: (payload: CostSubscriptionPayload) =>
    api.post<CostSubscription>("/api/v1/costs", payload),
  update: (id: string, payload: Partial<CostSubscriptionPayload>) =>
    api.patch<CostSubscription>(`/api/v1/costs/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/costs/${id}`),
  catalog: () => api.get<CostServiceCatalogItem[]>("/api/v1/costs/catalog"),
  settings: () => api.get<FinanceSettings>("/api/v1/costs/settings"),
  updateSettings: (payload: FinanceSettingsPayload) =>
    api.patch<FinanceSettings>("/api/v1/costs/settings", payload),
  summary: () => api.get<CostSummary>("/api/v1/costs/summary"),
  listUsage: (month?: string) =>
    api.get<CostUsageEntry[]>("/api/v1/costs/usage", month ? { month } : undefined),
  createUsage: (payload: CreateUsageEntryPayload) =>
    api.post<CostUsageEntry>("/api/v1/costs/usage", payload),
  removeUsage: (id: string) => api.delete<void>(`/api/v1/costs/usage/${id}`),
  usageSummary: (month?: string) =>
    api.get<UsageSummary>("/api/v1/costs/usage/summary", month ? { month } : undefined),
  usageSeries: (months?: number) =>
    api.get<CostUsageSeries>("/api/v1/costs/usage/series", months ? { months } : undefined),
};

/**
 * Despesas REALIZADAS da MilWeb.
 *
 * Vizinhas dos planos, e nunca somadas com eles: o resumo devolve
 * `planejadoBrl` e `realizadoBrl` separados, mais a diferenca. Somar os dois
 * daria dois Claudes.
 */
export const businessExpenseService = {
  list: (params: Record<string, string> = {}) =>
    api.get<BusinessExpense[]>("/api/v1/costs/expenses", params),
  summary: (from: string, to: string) =>
    api.get<BusinessExpenseSummary>("/api/v1/costs/expenses/summary", { from, to }),
  create: (payload: Record<string, unknown>) =>
    api.post<BusinessExpense>("/api/v1/costs/expenses", payload),
  update: (id: string, payload: Record<string, unknown>) =>
    api.patch<BusinessExpense>(`/api/v1/costs/expenses/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/costs/expenses/${id}`),
};
