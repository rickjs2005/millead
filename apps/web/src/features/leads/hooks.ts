import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  leadsService,
  type CreateLeadPayload,
  type ListLeadsParams,
  type UpdateLeadPayload,
} from "@/services/leads";

export function useLeads(params: ListLeadsParams) {
  return useQuery({
    queryKey: queryKeys.leads.list(params),
    queryFn: () => leadsService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leads.detail(id ?? ""),
    queryFn: () => leadsService.get(id!),
    enabled: !!id,
  });
}

export function useLeadActivities(leadId: string | undefined, page = 1) {
  return useQuery({
    queryKey: [...queryKeys.leads.activities(leadId ?? ""), page],
    queryFn: () => leadsService.activities(leadId!, page),
    enabled: !!leadId,
    placeholderData: (prev) => prev,
  });
}

function invalidateLeadLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["leads", "list"] });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLeadPayload) => leadsService.create(payload),
    onSuccess: () => {
      invalidateLeadLists(queryClient);
      toast.success("Lead criado.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao criar lead."),
  });
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateLeadPayload) => leadsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(id) });
      invalidateLeadLists(queryClient);
      toast.success("Lead atualizado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar lead."),
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadsService.delete(id),
    onSuccess: () => {
      invalidateLeadLists(queryClient);
      toast.success("Lead excluído.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao excluir lead."),
  });
}

export function useMoveLeadStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pipelineStageId }: { id: string; pipelineStageId: string }) =>
      leadsService.moveStage(id, pipelineStageId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(variables.id) });
      invalidateLeadLists(queryClient);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao mover o lead."),
  });
}

export function useAddLeadNote(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => leadsService.addNote(leadId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.activities(leadId) });
      toast.success("Nota adicionada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao adicionar nota."),
  });
}

export function useAddLeadContact(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      role?: string;
      email?: string;
      phone?: string;
      isPrimary?: boolean;
    }) => leadsService.addContact(leadId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
      toast.success("Contato adicionado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao adicionar contato."),
  });
}

export function useRemoveLeadContact(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => leadsService.removeContact(leadId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover contato."),
  });
}

export function useAddLeadTag(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => leadsService.addTag(leadId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao adicionar etiqueta."),
  });
}

export function useRemoveLeadTag(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => leadsService.removeTag(leadId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover etiqueta."),
  });
}
