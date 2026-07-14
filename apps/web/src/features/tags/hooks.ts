import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { tagsService } from "@/services/tags";

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags.list(), queryFn: tagsService.list });
}

export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      tagsService.create(name, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.list() });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar etiqueta."),
  });
}
