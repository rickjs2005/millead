import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { auditsService, type ListAuditsParams } from "@/services/audits";

const PENDING_STATUSES = new Set(["QUEUED", "RUNNING"]);
const POLL_INTERVAL_MS = 4000;

/**
 * Lista com polling automático: enquanto houver auditoria na fila ou
 * rodando, refaz a busca a cada 4s até tudo concluir/falhar.
 */
export function useAudits(params: ListAuditsParams) {
  return useQuery({
    queryKey: queryKeys.audits.list(params),
    queryFn: () => auditsService.list(params),
    placeholderData: (prev) => prev,
    refetchInterval: (query) =>
      query.state.data?.items.some((a) => PENDING_STATUSES.has(a.status))
        ? POLL_INTERVAL_MS
        : false,
  });
}

export function useAudit(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.audits.detail(id ?? ""),
    queryFn: () => auditsService.get(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data && PENDING_STATUSES.has(query.state.data.status) ? POLL_INTERVAL_MS : false,
  });
}

export function useRequestAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) => auditsService.create(companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audits", "list"] });
      toast.success("Auditoria enfileirada — o resultado aparece em instantes.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao solicitar auditoria."),
  });
}
