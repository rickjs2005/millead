import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  tasksService,
  type CreateTaskPayload,
  type ListTasksParams,
  type UpdateTaskPayload,
} from "@/services/tasks";

export function useTasks(params: ListTasksParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => tasksService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
      toast.success("Tarefa criada.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao criar tarefa."),
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTaskPayload) => tasksService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar tarefa."),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
      toast.success("Tarefa excluída.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir tarefa."),
  });
}
