import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  vaultDebtService,
  type ContactPayload,
  type DebtFilters,
  type DebtPayload,
  type PaymentPayload,
} from "@/services/vault-debts";

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Toda mutação de dívida invalida também as movimentações.
 *
 * Não é excesso de cautela: vincular uma baixa a um Pix muda o que aquela
 * movimentação **é** — ela deixa de ser receita. Sem invalidar, a lista de
 * movimentações continuaria mostrando a entrada como renda até alguém recarregar
 * a página, e os dois números na tela discordariam.
 */
async function invalidateDebtWorld(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["vault", "debts"] }),
    queryClient.invalidateQueries({ queryKey: ["vault", "debt-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] }),
  ]);
}

// ----- Pessoas -----

export function useVaultContacts(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vault.contacts(includeInactive),
    queryFn: () => vaultDebtService.listContacts(includeInactive),
  });
}

export function useCreateVaultContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ContactPayload) => vaultDebtService.createContact(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "contacts"] });
      toast.success("Pessoa adicionada.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível adicionar a pessoa.")),
  });
}

export function useUpdateVaultContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Partial<ContactPayload> & { isActive?: boolean }) =>
      vaultDebtService.updateContact(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "debts"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a pessoa.")),
  });
}

export function useDeleteVaultContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultDebtService.removeContact(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "contacts"] });
      toast.success("Pessoa removida.");
    },
    // A API recusa com 409 quando a pessoa ainda tem dívida, e a mensagem dela
    // já explica a saída (desativar em vez de apagar) — repetir aqui daria duas
    // versões da mesma regra.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a pessoa.")),
  });
}

// ----- Dívidas -----

export function useVaultDebts(filters: DebtFilters) {
  return useQuery({
    queryKey: queryKeys.vault.debts(filters),
    queryFn: () => vaultDebtService.list(filters),
  });
}

export function useVaultDebtSummary() {
  return useQuery({
    queryKey: queryKeys.vault.debtSummary(),
    queryFn: vaultDebtService.summary,
  });
}

export function useCreateVaultDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DebtPayload) => vaultDebtService.create(payload),
    onSuccess: async (_debt, variables) => {
      await invalidateDebtWorld(queryClient);
      toast.success(
        variables.markOriginReimbursable
          ? "Dívida criada e a compra marcada como reembolsável."
          : "Dívida registrada.",
      );
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível registrar a dívida.")),
  });
}

export function useUpdateVaultDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      description?: string;
      amount?: string;
      dueDate?: string | null;
      notes?: string | null;
      canceled?: boolean;
    }) => vaultDebtService.update(id, payload),
    onSuccess: async (_debt, variables) => {
      await invalidateDebtWorld(queryClient);
      if (variables.canceled !== undefined) {
        toast.success(variables.canceled ? "Dívida cancelada." : "Dívida reaberta.");
      }
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a dívida.")),
  });
}

export function useDeleteVaultDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultDebtService.remove(id),
    onSuccess: async () => {
      await invalidateDebtWorld(queryClient);
      toast.success("Dívida removida.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a dívida.")),
  });
}

// ----- Baixas -----

export function useAddDebtPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, ...payload }: { debtId: string } & PaymentPayload) =>
      vaultDebtService.addPayment(debtId, payload),
    onSuccess: async (debt) => {
      await invalidateDebtWorld(queryClient);
      toast.success(debt.status === "PAID" ? "Dívida quitada." : "Baixa registrada.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível registrar a baixa.")),
  });
}

export function useDeleteDebtPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, paymentId }: { debtId: string; paymentId: string }) =>
      vaultDebtService.removePayment(debtId, paymentId),
    onSuccess: async () => {
      await invalidateDebtWorld(queryClient);
      toast.success("Baixa removida.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a baixa.")),
  });
}
