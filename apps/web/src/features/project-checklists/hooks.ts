import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  projectChecklistsService,
  type CreateProjectChecklistPayload,
  type UpdatePhaseStatusPayload,
} from "@/services/project-checklists";

export function useProjectChecklists() {
  return useQuery({
    queryKey: queryKeys.projectChecklists.list(),
    queryFn: () => projectChecklistsService.list(),
  });
}

export function useProjectChecklist(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectChecklists.detail(id ?? ""),
    queryFn: () => projectChecklistsService.get(id!),
    enabled: !!id,
  });
}

export function useCreateProjectChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectChecklistPayload) => projectChecklistsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", "list"] });
      toast.success("Projeto criado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar projeto."),
  });
}

export function useUpdatePhaseStatus(checklistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      phaseNumber,
      payload,
    }: {
      phaseNumber: number;
      payload: UpdatePhaseStatusPayload;
    }) => projectChecklistsService.updatePhaseStatus(checklistId, phaseNumber, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.detail(checklistId) });
      queryClient.invalidateQueries({ queryKey: ["project-checklists", "list"] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar fase."),
  });
}

export function useDeleteProjectChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectChecklistsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", "list"] });
      toast.success("Projeto removido.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover projeto."),
  });
}
