import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { milsocialService } from "@/services/milsocial";
import type { SocialPostFormat } from "@/types/api";

export function useSocialPosts() {
  return useQuery({ queryKey: queryKeys.milsocial.posts(), queryFn: milsocialService.listPosts });
}

export function useComparison() {
  return useQuery({
    queryKey: queryKeys.milsocial.comparison(),
    queryFn: milsocialService.comparison,
  });
}

export function useSeries(postId: string | null) {
  return useQuery({
    queryKey: queryKeys.milsocial.series(postId ?? ""),
    queryFn: () => milsocialService.series(postId as string),
    enabled: !!postId,
  });
}

/** Sync e setFormat mudam posts/snapshots/comparação -- invalida tudo sob o prefixo. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["milsocial"] });
}

/**
 * Sem toast automático de erro/sucesso aqui de propósito: o resultado
 * ("X novos, Y snapshots") e o erro (incluindo o 503 de módulo não
 * configurado) precisam aparecer inline na página, não sumir num toast.
 */
export function useSyncMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: milsocialService.sync,
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetFormatMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, format }: { postId: string; format: SocialPostFormat }) =>
      milsocialService.setFormat(postId, format),
    onSuccess: () => invalidateAll(queryClient),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar o formato."),
  });
}

/** Sem invalidação: gerar a análise não muda posts/snapshots. */
export function useAnalysisMutation() {
  return useMutation({
    mutationFn: milsocialService.analysis,
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar a análise."),
  });
}
