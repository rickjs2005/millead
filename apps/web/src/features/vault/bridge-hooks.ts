import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { vaultBridgeService, type PushPayload } from "@/services/vault-bridge";

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Toda mutação da ponte invalida também o Centro de Custos.
 *
 * Enviar uma despesa muda um número que vive na outra tela, e um cache velho ali
 * mostraria o realizado do mês sem o lançamento que acabou de entrar — a pessoa
 * concluiria que o envio falhou e mandaria de novo.
 */
async function invalidateBridge(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["vault", "bridge"] }),
    queryClient.invalidateQueries({ queryKey: ["costs"] }),
  ]);
}

export function useVaultBridge(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.vault.bridge(range),
    queryFn: () => vaultBridgeService.list(range),
  });
}

export function useVaultBridgePlans() {
  return useQuery({
    queryKey: queryKeys.vault.bridgePlans(),
    queryFn: vaultBridgeService.plans,
  });
}

export function usePushToBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transactionId, ...payload }: { transactionId: string } & PushPayload) =>
      vaultBridgeService.push(transactionId, payload),
    onSuccess: async () => {
      await invalidateBridge(queryClient);
      toast.success("Despesa lançada no financeiro da MilWeb.");
    },
    // A API recusa o segundo envio com 409 e a mensagem dela já indica
    // sincronizar; repetir aqui daria duas versões da mesma orientação.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível lançar a despesa.")),
  });
}

export function useSyncBusinessExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => vaultBridgeService.sync(transactionId),
    onSuccess: async () => {
      await invalidateBridge(queryClient);
      toast.success("Valor alinhado com o rateio da compra.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível sincronizar.")),
  });
}

export function useRevertBusinessExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transactionId: string) => vaultBridgeService.revert(transactionId),
    onSuccess: async () => {
      await invalidateBridge(queryClient);
      toast.success("Envio desfeito — a despesa saiu do financeiro.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível desfazer o envio.")),
  });
}
