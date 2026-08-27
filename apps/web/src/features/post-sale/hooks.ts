import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { postSaleService, type UpdatePostSaleSettingsPayload } from "@/services/post-sale";

/** Enquanto a automação está na fila ou rodando, a tela se atualiza sozinha.
 *  Nos estados terminais o polling para -- automação que falhou não muda
 *  sozinha, e ficar refetchando é o que faria a tela "girar pra sempre"
 *  (mesmo raciocínio do polling de contrato em features/contracts/hooks.ts). */
const POLL_MS = 4000;

export function usePostSaleSettings() {
  return useQuery({
    queryKey: queryKeys.settings.postSaleAutomation(),
    queryFn: postSaleService.getSettings,
  });
}

export function useUpdatePostSaleSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdatePostSaleSettingsPayload) =>
      postSaleService.updateSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings.postSaleAutomation(), data);
      toast.success("Automação atualizada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar a automação."),
  });
}

export function usePostSaleExecution(contractId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.postSale.execution(contractId ?? ""),
    queryFn: () => postSaleService.getExecution(contractId!).then((r) => r.execution),
    enabled: !!contractId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "PENDING" || status === "RUNNING" ? POLL_MS : false;
    },
  });
}

/** Automações paradas -- card do painel. */
export function usePendingAutomations() {
  return useQuery({
    queryKey: queryKeys.postSale.pending(),
    queryFn: () => postSaleService.listPending().then((r) => r.items),
  });
}

export function useReprocessPostSale(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postSaleService.reprocess(contractId),
    onSuccess: () => {
      // A automação toca lead, recebimentos, briefing, projeto e tarefas --
      // invalidar só a execução deixaria as outras telas desatualizadas.
      queryClient.invalidateQueries({ queryKey: queryKeys.postSale.execution(contractId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.postSale.pending() });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
      queryClient.invalidateQueries({ queryKey: ["briefings"] });
      queryClient.invalidateQueries({ queryKey: ["project-checklists"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Reprocessamento na fila — só as etapas pendentes vão rodar.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao reprocessar a automação."),
  });
}
