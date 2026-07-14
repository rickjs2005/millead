import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { aiService, type DraftMessagePayload } from "@/services/ai";

/** Chave configurada no backend? Muda raramente -- cache generoso. */
export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.ai.status(),
    queryFn: aiService.status,
    staleTime: 5 * 60_000,
  });
}

function aiErrorToast(err: unknown, fallback: string) {
  toast.error(err instanceof ApiError ? err.message : fallback);
}

export function useScoreLead(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => aiService.scoreLead(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(leadId) });
      queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
    },
    onError: (err) => aiErrorToast(err, "Erro ao calcular o score."),
  });
}

export function useLeadReport(leadId: string) {
  return useMutation({
    mutationFn: () => aiService.reportLead(leadId),
    onError: (err) => aiErrorToast(err, "Erro ao gerar o relatório."),
  });
}

export function useDraftMessage(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: DraftMessagePayload) => aiService.draftMessage(leadId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", "list"] });
      toast.success("Rascunho gerado.");
    },
    onError: (err) => aiErrorToast(err, "Erro ao gerar a mensagem."),
  });
}
