import { api } from "./api-client";
import type {
  VaultAlert,
  VaultAlertRefresh,
  VaultClassificationRun,
  VaultRule,
  VaultSubscription,
  VaultSubscriptionStatus,
} from "@/types/api";

export interface SubscriptionPayload {
  name: string;
  merchantId: string | null;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  expectedAmount: string;
  currency: VaultSubscription["currency"];
  period: VaultSubscription["period"];
  customIntervalDays: number | null;
  lastChargeAt: string | null;
  nextRenewalAt: string | null;
  alertDaysBefore: number;
  priceTolerancePct: number;
  status: VaultSubscriptionStatus;
  autoRenew: boolean;
  costSubscriptionId: string | null;
  notes: string | null;
}

export const vaultSubscriptionService = {
  list: (status?: VaultSubscriptionStatus) =>
    api.get<VaultSubscription[]>("/api/v1/vault/subscriptions", status ? { status } : undefined),
  create: (payload: SubscriptionPayload) =>
    api.post<VaultSubscription>("/api/v1/vault/subscriptions", payload),
  update: (id: string, payload: Partial<SubscriptionPayload>) =>
    api.patch<VaultSubscription>(`/api/v1/vault/subscriptions/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/vault/subscriptions/${id}`),

  /** Verificação completa. É o que a abertura do Cofre chama — o push é só a
   *  segunda camada. */
  refreshAlerts: () => api.post<VaultAlertRefresh>("/api/v1/vault/alerts/refresh"),
  listAlerts: () => api.get<VaultAlert[]>("/api/v1/vault/alerts"),
  countAlerts: () => api.get<{ count: number }>("/api/v1/vault/alerts/count"),
  markRead: (id: string) => api.patch<VaultAlert>(`/api/v1/vault/alerts/${id}/read`),
  snooze: (id: string, until: string) =>
    api.patch<VaultAlert>(`/api/v1/vault/alerts/${id}/snooze`, { until }),
};

export interface RulePayload {
  name: string | null;
  priority: number;
  matchType: VaultRule["matchType"];
  matchValue: string | null;
  matchMerchantId: string | null;
  matchAccountId: string | null;
  matchCardId: string | null;
  matchAmountMin: string | null;
  matchAmountMax: string | null;
  setMerchantId: string | null;
  setCategoryId: string | null;
  setSubscriptionId: string | null;
  businessPercent: string | null;
}

export const vaultRuleService = {
  list: (includeInactive = false) =>
    api.get<VaultRule[]>("/api/v1/vault/rules", { includeInactive }),
  create: (payload: RulePayload) => api.post<VaultRule>("/api/v1/vault/rules", payload),
  update: (id: string, payload: Partial<RulePayload> & { isActive?: boolean }) =>
    api.patch<VaultRule>(`/api/v1/vault/rules/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/vault/rules/${id}`),

  run: (limit = 500) =>
    api.post<VaultClassificationRun>("/api/v1/vault/classification/run", { limit }),
  /** Correção manual: "só esta" (sem `createRule`) ou "criar regra para as
   *  próximas" (com). Criar regra não mexe no passado. */
  correct: (
    transactionId: string,
    payload: {
      merchantId?: string | null;
      categoryId?: string | null;
      subscriptionId?: string | null;
      businessPercent?: string | null;
      createRule?: {
        name: string | null;
        matchType: "CONTAINS" | "STARTS_WITH" | "EXACT";
        matchValue: string;
        priority: number;
        scopeToOrigin: boolean;
      } | null;
    },
  ) => api.patch<unknown>(`/api/v1/vault/transactions/${transactionId}/classification`, payload),
};
