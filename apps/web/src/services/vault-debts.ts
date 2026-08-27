import { api } from "./api-client";
import type { VaultContact, VaultDebt, VaultDebtDirection, VaultDebtSummary } from "@/types/api";

export interface ContactPayload {
  name: string;
  contact: string | null;
  notes: string | null;
}

export interface DebtPayload {
  contactId: string;
  direction: VaultDebtDirection;
  description: string;
  amount: string;
  currency: "BRL" | "USD" | "EUR";
  dueDate: string | null;
  originTransactionId: string | null;
  notes: string | null;
  /** Marca a compra de origem como reembolsável no mesmo movimento — é o que
   *  tira os R$100 do jantar do seu consumo pessoal. */
  markOriginReimbursable: boolean;
}

export interface DebtFilters {
  direction?: VaultDebtDirection;
  contactId?: string;
  includeCanceled?: boolean;
  includeSettled?: boolean;
}

export interface PaymentPayload {
  amount: string;
  paidAt: string;
  transactionId: string | null;
  note: string | null;
}

export const vaultDebtService = {
  listContacts: (includeInactive = false) =>
    api.get<VaultContact[]>("/api/v1/vault/contacts", { includeInactive: String(includeInactive) }),
  createContact: (payload: ContactPayload) =>
    api.post<VaultContact>("/api/v1/vault/contacts", payload),
  updateContact: (id: string, payload: Partial<ContactPayload> & { isActive?: boolean }) =>
    api.patch<VaultContact>(`/api/v1/vault/contacts/${id}`, payload),
  removeContact: (id: string) => api.delete<void>(`/api/v1/vault/contacts/${id}`),

  list: (filters: DebtFilters) =>
    api.get<VaultDebt[]>(
      "/api/v1/vault/debts",
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ),
    ),
  summary: () => api.get<VaultDebtSummary>("/api/v1/vault/debts/summary"),
  create: (payload: DebtPayload) => api.post<VaultDebt>("/api/v1/vault/debts", payload),
  update: (
    id: string,
    payload: {
      description?: string;
      amount?: string;
      dueDate?: string | null;
      notes?: string | null;
      canceled?: boolean;
    },
  ) => api.patch<VaultDebt>(`/api/v1/vault/debts/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/vault/debts/${id}`),

  addPayment: (debtId: string, payload: PaymentPayload) =>
    api.post<VaultDebt>(`/api/v1/vault/debts/${debtId}/payments`, payload),
  removePayment: (debtId: string, paymentId: string) =>
    api.delete<VaultDebt>(`/api/v1/vault/debts/${debtId}/payments/${paymentId}`),
};
