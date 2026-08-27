import { api } from "./api-client";
import type { CostPlanOption, VaultBridgeItem } from "@/types/api";

export interface PushPayload {
  /** Obrigatoria: e a pessoa que decide o que atravessa pro financeiro da
   *  empresa. A alternativa seria copiar a linha crua do extrato. */
  description: string;
  category: string;
  costSubscriptionId: string | null;
  companyId: string | null;
  notes: string | null;
}

/** A ponte, do lado do Cofre. Exige sessao elevada E permissao no financeiro. */
export const vaultBridgeService = {
  list: (range: { from?: string; to?: string } = {}) =>
    api.get<VaultBridgeItem[]>(
      "/api/v1/vault/business/allocations",
      Object.fromEntries(Object.entries(range).filter(([, v]) => v)) as Record<string, string>,
    ),
  plans: () => api.get<CostPlanOption[]>("/api/v1/vault/business/plans"),
  push: (transactionId: string, payload: PushPayload) =>
    api.post<VaultBridgeItem>(`/api/v1/vault/business/allocations/${transactionId}`, payload),
  sync: (transactionId: string) =>
    api.post<VaultBridgeItem>(`/api/v1/vault/business/allocations/${transactionId}/sync`),
  revert: (transactionId: string) =>
    api.delete<VaultBridgeItem>(`/api/v1/vault/business/allocations/${transactionId}`),
};
