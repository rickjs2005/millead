import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { costsService } from "@/services/costs";
import type {
  CostSubscriptionPayload,
  CreateUsageEntryPayload,
  FinanceSettingsPayload,
} from "@/types/api";

export function useCostSubscriptions() {
  return useQuery({ queryKey: queryKeys.costs.list(), queryFn: costsService.list });
}

export function useCostCatalog() {
  return useQuery({ queryKey: queryKeys.costs.catalog(), queryFn: costsService.catalog });
}

export function useFinanceSettings() {
  return useQuery({ queryKey: queryKeys.costs.settings(), queryFn: costsService.settings });
}

export function useCostSummary(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.costs.summary(),
    queryFn: costsService.summary,
    enabled: options?.enabled ?? true,
  });
}

export function useUsage(month: string) {
  return useQuery({
    queryKey: queryKeys.costs.usage(month),
    queryFn: () => costsService.listUsage(month),
  });
}

export function useUsageSummary(month: string) {
  return useQuery({
    queryKey: queryKeys.costs.usageSummary(month),
    queryFn: () => costsService.usageSummary(month),
  });
}

export function useUsageSeries(months?: number) {
  return useQuery({
    queryKey: queryKeys.costs.usageSeries(months),
    queryFn: () => costsService.usageSeries(months),
  });
}

/** Invalida list, catalog, settings e summary de uma vez -- qualquer mutação
 * de custo/config pode mudar o summary, então invalidamos tudo pelo prefixo. */
function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["costs"] });
}

export function useCreateCostSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CostSubscriptionPayload) => costsService.create(payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Custo cadastrado.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao cadastrar custo."),
  });
}

export function useUpdateCostSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CostSubscriptionPayload> }) =>
      costsService.update(id, payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Custo atualizado.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar custo."),
  });
}

export function useDeleteCostSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costsService.remove(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Custo removido.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao remover custo."),
  });
}

export function useCreateUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUsageEntryPayload) => costsService.createUsage(payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Consumo lançado.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao lançar consumo."),
  });
}

export function useDeleteUsage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => costsService.removeUsage(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Lançamento removido.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao remover lançamento."),
  });
}

export function useUpdateFinanceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FinanceSettingsPayload) => costsService.updateSettings(payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Configurações atualizadas.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar configurações."),
  });
}
