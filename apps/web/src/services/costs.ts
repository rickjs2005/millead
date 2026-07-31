import { api } from "./api-client";
import type {
  CostServiceCatalogItem,
  CostSubscription,
  CostSubscriptionPayload,
  CostSummary,
  FinanceSettings,
  FinanceSettingsPayload,
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
};
