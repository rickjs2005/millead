import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BRIEFING_ACTIVE_STATUSES } from "@/features/briefings/briefing-labels";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  briefingsService,
  type CreateBriefingPayload,
  type CreateCustomBriefingPayload,
  type ListBriefingsParams,
} from "@/services/briefings";

const POLL_MS = 5000;

export function useBriefings(params: ListBriefingsParams) {
  return useQuery({
    queryKey: queryKeys.briefings.list(params),
    queryFn: () => briefingsService.list(params),
    placeholderData: (prev) => prev,
    refetchInterval: (query) =>
      query.state.data?.items.some((b) => BRIEFING_ACTIVE_STATUSES.includes(b.status))
        ? POLL_MS
        : false,
  });
}

export function useBriefing(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.briefings.detail(id ?? ""),
    queryFn: () => briefingsService.get(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data && BRIEFING_ACTIVE_STATUSES.includes(query.state.data.status)
        ? POLL_MS
        : false,
  });
}

export function useBriefingTemplates() {
  return useQuery({
    queryKey: queryKeys.briefings.templates(),
    queryFn: briefingsService.listTemplates,
    staleTime: 5 * 60_000,
  });
}

export function useBriefingTemplate(key: string | undefined) {
  return useQuery({
    queryKey: queryKeys.briefings.template(key ?? ""),
    queryFn: () => briefingsService.getTemplate(key!),
    enabled: !!key,
    staleTime: 5 * 60_000,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["briefings"] });
}

export function useCreateBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBriefingPayload) => briefingsService.create(payload),
    onSuccess: () => invalidateAll(queryClient),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar briefing."),
  });
}

export function useCreateCustomBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomBriefingPayload) => briefingsService.createCustom(payload),
    onSuccess: () => invalidateAll(queryClient),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar briefing personalizado."),
  });
}

export function useArchiveBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => briefingsService.archive(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Briefing arquivado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao arquivar briefing."),
  });
}

export function useDuplicateBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => briefingsService.duplicate(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Briefing duplicado — novo link gerado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao duplicar briefing."),
  });
}

export function useResendBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: "email" | "whatsapp" }) =>
      channel === "email" ? briefingsService.resendEmail(id) : briefingsService.resendWhatsapp(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Reenviado com sucesso.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao reenviar."),
  });
}
