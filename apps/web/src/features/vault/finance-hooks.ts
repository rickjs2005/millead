import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  vaultFinanceService,
  type AccountPayload,
  type CardPayload,
  type TransactionFilters,
} from "@/services/vault-finance";
import type { PersonalSplitKind } from "@/types/api";

/**
 * Núcleo do Cofre. Toda invalidação usa o prefixo `["vault", …]`, então
 * fechar o Cofre (`removeQueries(["vault"])`) limpa tudo de uma vez — nenhum
 * dado financeiro sobrevive no cache depois do bloqueio.
 */

/** Mensagem de erro da API, com um fallback que não mente sobre a causa. */
function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// ----- Contas -----

export function useVaultAccounts(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vault.accounts(includeInactive),
    queryFn: () => vaultFinanceService.listAccounts(includeInactive),
  });
}

export function useCreateVaultAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AccountPayload) => vaultFinanceService.createAccount(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "accounts"] });
      toast.success("Conta criada.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível criar a conta.")),
  });
}

export function useUpdateVaultAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Partial<AccountPayload> & { isActive?: boolean }) =>
      vaultFinanceService.updateAccount(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "accounts"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a conta.")),
  });
}

export function useDeleteVaultAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultFinanceService.deleteAccount(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "accounts"] });
      toast.success("Conta removida.");
    },
    // A API responde 409 com a instrução de desativar quando há histórico — a
    // mensagem dela é melhor que qualquer texto genérico daqui.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a conta.")),
  });
}

// ----- Cartões -----

export function useVaultCards(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vault.cards(includeInactive),
    queryFn: () => vaultFinanceService.listCards(includeInactive),
  });
}

export function useCreateVaultCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CardPayload) => vaultFinanceService.createCard(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "cards"] });
      toast.success("Cartão criado.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível criar o cartão.")),
  });
}

export function useUpdateVaultCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Partial<CardPayload> & { isActive?: boolean }) =>
      vaultFinanceService.updateCard(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "cards"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar o cartão.")),
  });
}

export function useDeleteVaultCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultFinanceService.deleteCard(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "cards"] });
      toast.success("Cartão removido.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover o cartão.")),
  });
}

// ----- Categorias -----

export function useVaultCategories(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vault.categories(includeInactive),
    queryFn: () => vaultFinanceService.listCategories(includeInactive),
  });
}

export function useCreateVaultCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parentId: string | null; color: string | null }) =>
      vaultFinanceService.createCategory(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "categories"] });
      toast.success("Categoria criada.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível criar a categoria.")),
  });
}

export function useUpdateVaultCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; isActive?: boolean }) =>
      vaultFinanceService.updateCategory(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "categories"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a categoria.")),
  });
}

export function useDeleteVaultCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultFinanceService.deleteCategory(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "categories"] });
      toast.success("Categoria removida.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a categoria.")),
  });
}

// ----- Fornecedores -----

export function useVaultMerchants(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vault.merchants(includeInactive),
    queryFn: () => vaultFinanceService.listMerchants(includeInactive),
  });
}

export function useCreateVaultMerchant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; defaultCategoryId: string | null; aliases: string[] }) =>
      vaultFinanceService.createMerchant(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "merchants"] });
      toast.success("Fornecedor criado.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível criar o fornecedor.")),
  });
}

export function useAddVaultAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, alias }: { id: string; alias: string }) =>
      vaultFinanceService.addAlias(id, alias),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "merchants"] });
    },
    // Um alias só pode pertencer a um fornecedor — a API devolve 409 dizendo
    // qual, e essa mensagem é a informação útil.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível adicionar o alias.")),
  });
}

export function useRemoveVaultAlias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, aliasId }: { id: string; aliasId: string }) =>
      vaultFinanceService.removeAlias(id, aliasId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "merchants"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover o alias.")),
  });
}

export function useDeleteVaultMerchant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultFinanceService.deleteMerchant(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "merchants"] });
      toast.success("Fornecedor removido.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover o fornecedor.")),
  });
}

// ----- Movimentações -----

/** Resumo do mês. É a única leitura que combina as regras de todas as fases —
 *  ver `vault-summary.ts` na API sobre a conta que precisa fechar. */
export function useVaultMonthSummary(month: string) {
  return useQuery({
    queryKey: queryKeys.vault.monthSummary(month),
    queryFn: () => vaultFinanceService.monthSummary(month),
  });
}

export function useVaultTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.vault.transactions(filters),
    queryFn: () => vaultFinanceService.listTransactions(filters),
    // Mantém a página anterior visível enquanto a nova carrega, pra a tabela
    // não piscar a cada mudança de filtro.
    placeholderData: (previous) => previous,
  });
}

export function useUpdateVaultTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      note?: string | null;
      status?: never;
      isTransfer?: boolean;
    }) => vaultFinanceService.updateTransaction(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a movimentação.")),
  });
}

export function useReplaceVaultSplits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      splits,
    }: {
      id: string;
      splits: Array<{
        kind: PersonalSplitKind;
        amount: string;
        categoryId: string | null;
        note: string | null;
      }>;
    }) => vaultFinanceService.replaceSplits(id, splits),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
      toast.success("Rateio atualizado.");
    },
    // A soma não pode passar do valor — a API recusa com a diferença na
    // mensagem, que é exatamente o que a pessoa precisa saber.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar o rateio.")),
  });
}

// ----- Faturas -----

export function useVaultStatements(cardId?: string) {
  return useQuery({
    queryKey: queryKeys.vault.statements(cardId),
    queryFn: () => vaultFinanceService.listStatements(cardId),
  });
}

export function usePayVaultStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: string;
      amount: string;
      date: string;
      accountId: string | null;
    }) => vaultFinanceService.payStatement(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "statements"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
      toast.success("Pagamento registrado.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível registrar o pagamento.")),
  });
}
