import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  vaultRuleService,
  vaultSubscriptionService,
  type RulePayload,
  type SubscriptionPayload,
} from "@/services/vault-subscriptions";
import type { VaultSubscriptionStatus } from "@/types/api";

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// ----- Assinaturas -----

export function useVaultSubscriptions(status?: VaultSubscriptionStatus) {
  return useQuery({
    queryKey: queryKeys.vault.subscriptions(status),
    queryFn: () => vaultSubscriptionService.list(status),
  });
}

export function useCreateVaultSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubscriptionPayload) => vaultSubscriptionService.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "subscriptions"] });
      toast.success("Assinatura criada.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível criar a assinatura.")),
  });
}

export function useUpdateVaultSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Partial<SubscriptionPayload>) =>
      vaultSubscriptionService.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "subscriptions"] });
      // Pausar ou mudar periodicidade muda o que é alerta a partir de agora.
      await queryClient.invalidateQueries({ queryKey: ["vault", "alerts"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a assinatura.")),
  });
}

export function useDeleteVaultSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultSubscriptionService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "subscriptions"] });
      toast.success("Assinatura removida.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a assinatura.")),
  });
}

// ----- Alertas -----

export function useVaultAlerts() {
  return useQuery({
    queryKey: queryKeys.vault.alerts(),
    queryFn: vaultSubscriptionService.listAlerts,
  });
}

/**
 * Contador do badge.
 *
 * `staleTime` curto porque o número muda a cada verificação, e um badge
 * desatualizado é pior que badge nenhum: ele diz que não há nada a ver.
 */
export function useVaultAlertCount() {
  return useQuery({
    queryKey: queryKeys.vault.alertCount(),
    queryFn: vaultSubscriptionService.countAlerts,
    staleTime: 30_000,
  });
}

/**
 * Verificação completa. É o primeiro nível de entrega — o que garante que o
 * alerta aparece mesmo com o worker dormindo no free tier.
 */
export function useRefreshVaultAlerts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: vaultSubscriptionService.refreshAlerts,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "alert-count"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "subscriptions"] });
      if (result.cobrancasVinculadas > 0) {
        await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
      }
    },
    // Sem toast de erro: a verificação roda sozinha ao abrir o Cofre, e um
    // aviso de falha a cada entrada seria ruído — a central continua
    // mostrando o que já existe.
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultSubscriptionService.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "alert-count"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível marcar como lido.")),
  });
}

export function useSnoozeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) =>
      vaultSubscriptionService.snooze(id, until),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "alerts"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "alert-count"] });
      toast.success("Alerta adiado.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível adiar o alerta.")),
  });
}

// ----- Regras e classificação -----

export function useVaultRules(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.vault.rules(includeInactive),
    queryFn: () => vaultRuleService.list(includeInactive),
  });
}

export function useCreateVaultRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RulePayload) => vaultRuleService.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "rules"] });
      toast.success("Regra criada.");
    },
    // A API recusa regra sem condição (casaria com tudo) e regra sem ação
    // (não classifica nada) — a mensagem dela explica qual dos dois é.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível criar a regra.")),
  });
}

export function useUpdateVaultRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Partial<RulePayload> & { isActive?: boolean }) =>
      vaultRuleService.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "rules"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a regra.")),
  });
}

export function useDeleteVaultRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultRuleService.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "rules"] });
      toast.success("Regra removida.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover a regra.")),
  });
}

export function useRunClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) => vaultRuleService.run(limit),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
      toast.success(
        result.classificadas === 0
          ? "Nenhuma movimentação nova foi classificada."
          : `${result.classificadas} de ${result.processadas} classificadas.`,
      );
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível classificar.")),
  });
}

/** Correção manual: "só esta" ou "criar regra para as próximas". */
export function useCorrectClassification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      transactionId,
      ...payload
    }: Parameters<typeof vaultRuleService.correct>[1] & { transactionId: string }) =>
      vaultRuleService.correct(transactionId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
      if (variables.createRule) {
        await queryClient.invalidateQueries({ queryKey: ["vault", "rules"] });
        toast.success("Classificação salva e regra criada para as próximas.");
      } else {
        toast.success("Classificação salva.");
      }
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar a classificação.")),
  });
}
