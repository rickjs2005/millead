import { api } from "./api-client";
import type {
  VaultMonthSummary,
  PersonalDateBasis,
  PersonalDirection,
  PersonalSplitKind,
  PersonalTransactionStatus,
  VaultAccount,
  VaultCard,
  VaultCategoryTree,
  VaultMerchant,
  VaultStatement,
  VaultTransaction,
  VaultTransactionPage,
} from "@/types/api";

export interface AccountPayload {
  name: string;
  institution: string | null;
  type: VaultAccount["type"];
  currency: VaultAccount["currency"];
  last4: string | null;
  reportedBalance: string | null;
  reportedBalanceAt: string | null;
}

export interface CardPayload {
  name: string;
  institution: string | null;
  last4: string | null;
  limitAmount: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  basis?: PersonalDateBasis;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  merchantId?: string;
  status?: PersonalTransactionStatus;
  direction?: PersonalDirection;
  includeTransfers?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Núcleo do Cofre. Tudo atrás da sessão elevada — um 401 `VAULT_LOCKED`
 *  aqui significa "reabra o Cofre", não "faça login". */
export const vaultFinanceService = {
  monthSummary: (month: string) =>
    api.get<VaultMonthSummary>("/api/v1/vault/summary", { month }),
  listAccounts: (includeInactive = false) =>
    api.get<VaultAccount[]>("/api/v1/vault/accounts", { includeInactive }),
  createAccount: (payload: AccountPayload) =>
    api.post<VaultAccount>("/api/v1/vault/accounts", payload),
  updateAccount: (id: string, payload: Partial<AccountPayload> & { isActive?: boolean }) =>
    api.patch<VaultAccount>(`/api/v1/vault/accounts/${id}`, payload),
  deleteAccount: (id: string) => api.delete<void>(`/api/v1/vault/accounts/${id}`),

  listCards: (includeInactive = false) =>
    api.get<VaultCard[]>("/api/v1/vault/cards", { includeInactive }),
  createCard: (payload: CardPayload) => api.post<VaultCard>("/api/v1/vault/cards", payload),
  updateCard: (id: string, payload: Partial<CardPayload> & { isActive?: boolean }) =>
    api.patch<VaultCard>(`/api/v1/vault/cards/${id}`, payload),
  deleteCard: (id: string) => api.delete<void>(`/api/v1/vault/cards/${id}`),

  listCategories: (includeInactive = false) =>
    api.get<VaultCategoryTree[]>("/api/v1/vault/categories", { includeInactive }),
  createCategory: (payload: { name: string; parentId: string | null; color: string | null }) =>
    api.post<VaultCategoryTree>("/api/v1/vault/categories", payload),
  updateCategory: (id: string, payload: { name?: string; isActive?: boolean }) =>
    api.patch<VaultCategoryTree>(`/api/v1/vault/categories/${id}`, payload),
  deleteCategory: (id: string) => api.delete<void>(`/api/v1/vault/categories/${id}`),

  listMerchants: (includeInactive = false) =>
    api.get<VaultMerchant[]>("/api/v1/vault/merchants", { includeInactive }),
  createMerchant: (payload: {
    name: string;
    defaultCategoryId: string | null;
    aliases: string[];
  }) => api.post<VaultMerchant>("/api/v1/vault/merchants", payload),
  updateMerchant: (
    id: string,
    payload: { name?: string; defaultCategoryId?: string | null; isActive?: boolean },
  ) => api.patch<VaultMerchant>(`/api/v1/vault/merchants/${id}`, payload),
  deleteMerchant: (id: string) => api.delete<void>(`/api/v1/vault/merchants/${id}`),
  addAlias: (id: string, alias: string) =>
    api.post<VaultMerchant>(`/api/v1/vault/merchants/${id}/aliases`, { alias }),
  removeAlias: (id: string, aliasId: string) =>
    api.delete<void>(`/api/v1/vault/merchants/${id}/aliases/${aliasId}`),

  listTransactions: (filters: TransactionFilters) =>
    api.get<VaultTransactionPage>("/api/v1/vault/transactions", {
      ...filters,
      includeTransfers: filters.includeTransfers ?? false,
    }),
  getTransaction: (id: string) => api.get<VaultTransaction>(`/api/v1/vault/transactions/${id}`),
  updateTransaction: (
    id: string,
    payload: { note?: string | null; status?: PersonalTransactionStatus; isTransfer?: boolean },
  ) => api.patch<VaultTransaction>(`/api/v1/vault/transactions/${id}`, payload),
  deleteTransaction: (id: string) => api.delete<void>(`/api/v1/vault/transactions/${id}`),
  replaceSplits: (
    id: string,
    splits: Array<{
      kind: PersonalSplitKind;
      amount: string;
      categoryId: string | null;
      note: string | null;
    }>,
  ) => api.put<VaultTransaction>(`/api/v1/vault/transactions/${id}/splits`, { splits }),

  listStatements: (cardId?: string) =>
    api.get<VaultStatement[]>("/api/v1/vault/statements", cardId ? { cardId } : undefined),
  payStatement: (id: string, payload: { amount: string; date: string; accountId: string | null }) =>
    api.post<VaultStatement>(`/api/v1/vault/statements/${id}/payments`, payload),
};
