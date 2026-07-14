import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { pipelinesService } from "@/services/pipelines";

export function usePipelines() {
  return useQuery({
    queryKey: queryKeys.pipelines.list(),
    queryFn: pipelinesService.list,
    staleTime: 5 * 60_000, // estrutura de pipeline muda pouco -- cache mais generoso
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, isDefault }: { name: string; isDefault?: boolean }) =>
      pipelinesService.create(name, isDefault),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list() });
      toast.success("Pipeline criado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar pipeline."),
  });
}

export function useAddPipelineStage(pipelineId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      order: number;
      color?: string;
      isWon?: boolean;
      isLost?: boolean;
    }) => pipelinesService.addStage(pipelineId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.list() });
      queryClient.invalidateQueries({ queryKey: queryKeys.pipelines.detail(pipelineId) });
      toast.success("Estágio adicionado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao adicionar estágio."),
  });
}
