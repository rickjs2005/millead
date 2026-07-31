import { api } from "./api-client";
import type {
  CostServiceCatalogItem,
  CostSubscription,
  CostSubscriptionPayload,
  CostSummary,
  CostUsageEntry,
  CreateUsageEntryPayload,
  FinanceSettings,
  FinanceSettingsPayload,
  UsageSummary,
} from "@/types/api";

export const costsService = {
  list: () => api.get<CostSubscription[]>("/api/v1/costs"),
  create: (payload: CostSubscriptionPayload) => api.post<CostSubscription>("/api/v1/costs", payload),
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
};
