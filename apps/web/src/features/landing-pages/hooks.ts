import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  landingPagesService,
  type CreateLandingPagePayload,
  type ListLandingPagesParams,
} from "@/services/landing-pages";

const PENDING = new Set(["QUEUED", "GENERATING"]);
const POLL_MS = 5000;

/** Lista com polling enquanto houver página na fila/gerando. */
export function useLandingPages(params: ListLandingPagesParams) {
  return useQuery({
    queryKey: queryKeys.landingPages.list(params),
    queryFn: () => landingPagesService.list(params),
    placeholderData: (prev) => prev,
    refetchInterval: (query) =>
      query.state.data?.items.some((p) => PENDING.has(p.status)) ? POLL_MS : false,
  });
}

/** Detalhe (inclui o HTML) -- usado pelo preview. */
export function useLandingPage(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.landingPages.detail(id ?? ""),
    queryFn: () => landingPagesService.get(id!),
    enabled: !!id,
  });
}

function invalidateList(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["landing-pages", "list"] });
}

export function useCreateLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateLandingPagePayload) => landingPagesService.create(payload),
    onSuccess: () => {
      invalidateList(queryClient);
      toast.success("Geração iniciada — a página aparece na lista em 1-2 minutos.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar a página."),
  });
}

export function useRegenerateLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, brief }: { id: string; brief?: string }) =>
      landingPagesService.regenerate(id, brief),
    onSuccess: (page) => {
      invalidateList(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.landingPages.detail(page.id) });
      toast.success("Regeneração iniciada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao regenerar a página."),
  });
}

export function usePublishLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      landingPagesService.publish(id, published),
    onSuccess: (page) => {
      invalidateList(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.landingPages.detail(page.id) });
      toast.success(page.isPublished ? "Página publicada!" : "Página despublicada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao publicar a página."),
  });
}

export function useDeleteLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => landingPagesService.delete(id),
    onSuccess: () => {
      invalidateList(queryClient);
      toast.success("Landing page excluída.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir a página."),
  });
}
