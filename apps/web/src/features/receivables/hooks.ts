import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { receivablesService } from "@/services/receivables";
import type {
  CreatePlanPayload,
  PayReceivablePayload,
  UpdateReceivablePayload,
} from "@/types/api";

export function useReceivablesByContract(contractId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.receivables.byContract(contractId ?? ""),
    queryFn: () => receivablesService.listByContract(contractId!),
    enabled: !!contractId,
  });
}

export function useReceivableContracts() {
  return useQuery({
    queryKey: queryKeys.receivables.contracts(),
    queryFn: receivablesService.listContracts,
  });
}

export function useReceivablesSummary(month?: string) {
  return useQuery({
    queryKey: queryKeys.receivables.summary(month),
    queryFn: () => receivablesService.summary(month),
  });
}

/** Margem só faz sentido quando o contrato tem `proposalId` -- passe
 * `enabled: false` quando não houver, pra não bater na API à toa. */
export function useContractMargin(contractId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.receivables.margin(contractId ?? ""),
    queryFn: () => receivablesService.margin(contractId!),
    enabled: !!contractId && (options?.enabled ?? true),
  });
}

/** Invalida todas as sub-queries de receivables (prefixo) e, quando um
 * contractId é conhecido, o detalhe do contrato (a "Recebimento" mostrada
 * lá reage a qualquer mutação de parcela). */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, contractId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.receivables.all() });
  if (contractId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contractId) });
  }
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePlanPayload) => receivablesService.createPlan(payload),
    onSuccess: (_data, variables) => {
      invalidateAll(queryClient, variables.contractId);
      toast.success("Plano de recebimento criado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar plano de recebimento."),
  });
}

export function usePayReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PayReceivablePayload }) =>
      receivablesService.pay(id, payload),
    onSuccess: (data) => {
      invalidateAll(queryClient, data.contractId);
      toast.success("Parcela baixada.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao baixar parcela."),
  });
}

export function useUnpayReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => receivablesService.unpay(id),
    onSuccess: (data) => {
      invalidateAll(queryClient, data.contractId);
      toast.success("Baixa desfeita.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao desfazer baixa."),
  });
}

export function useUpdateReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateReceivablePayload }) =>
      receivablesService.update(id, payload),
    onSuccess: (data) => {
      invalidateAll(queryClient, data.contractId);
      toast.success("Parcela atualizada.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar parcela."),
  });
}

export function useDeleteReceivable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; contractId: string }) => receivablesService.remove(id),
    onSuccess: (_data, variables) => {
      invalidateAll(queryClient, variables.contractId);
      toast.success("Parcela excluída.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao excluir parcela."),
  });
}
