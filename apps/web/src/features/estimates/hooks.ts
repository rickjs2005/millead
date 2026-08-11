import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { estimatesService, type ListEstimatesParams } from "@/services/estimates";
import type { EstimatePayload } from "@/types/api";

export function useEstimates(params: ListEstimatesParams = {}) {
  return useQuery({
    queryKey: queryKeys.estimates.list(params),
    queryFn: () => estimatesService.list(params),
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: queryKeys.estimates.detail(id),
    queryFn: () => estimatesService.get(id),
    enabled: !!id,
  });
}

export function useEstimateProducts() {
  return useQuery({ queryKey: queryKeys.estimates.products(), queryFn: estimatesService.products });
}

/** Invalida todo o namespace "estimates" -- lista e detalhes dependem uns dos outros. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["estimates"] });
}

export function useCreateEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EstimatePayload) => estimatesService.create(payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Orçamento criado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar orçamento."),
  });
}

export function useUpdateEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<EstimatePayload> }) =>
      estimatesService.update(id, payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Orçamento atualizado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar orçamento."),
  });
}

export function useDeleteEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => estimatesService.remove(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Orçamento removido.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover orçamento."),
  });
}

/** Conversão orçamento -> proposta (Fase 3; Fase 6 tira o preço do body --
 * a API resolve finalPrice salvo -> recomendado). Invalida `estimates` (o
 * orçamento vira CONVERTED) E `proposals` (a proposta nova precisa aparecer
 * na lista) -- os dois namespaces mudam no mesmo request. Abrir o pdfUrl em
 * nova aba é responsabilidade do hook (antes vivia no dialog de conversão,
 * removido na Fase 6 -- conversão direta via ConfirmDialog no editor). */
export function useConvertEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => estimatesService.convert(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Proposta gerada com sucesso.");
      window.open(result.pdfUrl, "_blank");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao gerar proposta."),
  });
}
