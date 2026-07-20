import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  messagesService,
  type CreateTemplatePayload,
  type ListMessagesParams,
  type UpdateMessagePayload,
  type UpdateTemplatePayload,
} from "@/services/messages";

export function useMessages(params: ListMessagesParams) {
  return useQuery({
    queryKey: queryKeys.messages.list(params),
    queryFn: () => messagesService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateMessagePayload }) =>
      messagesService.update(id, payload),
    onSuccess: (message, { payload }) => {
      queryClient.invalidateQueries({ queryKey: ["messages", "list"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(message.leadId) });
      if (payload.status === "SENT") toast.success("Mensagem marcada como enviada.");
      else toast.success("Mensagem atualizada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar mensagem."),
  });
}

export function useMessageTemplates() {
  return useQuery({
    queryKey: queryKeys.messages.templates(),
    queryFn: messagesService.listTemplates,
    staleTime: 60_000,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTemplatePayload) => messagesService.createTemplate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.templates() });
      toast.success("Modelo criado.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao criar modelo."),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTemplatePayload }) =>
      messagesService.updateTemplate(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.templates() });
      toast.success("Modelo atualizado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar modelo."),
  });
}
