import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CONTRACT_PENDING_STATUSES } from "@/features/contracts/contract-labels";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  contractsService,
  type CreateContractPayload,
  type ListContractsParams,
} from "@/services/contracts";

const POLL_MS = 4000;

export function useContracts(params: ListContractsParams) {
  return useQuery({
    queryKey: queryKeys.contracts.list(params),
    queryFn: () => contractsService.list(params),
    placeholderData: (prev) => prev,
    refetchInterval: (query) =>
      query.state.data?.items.some((c) => CONTRACT_PENDING_STATUSES.includes(c.status))
        ? POLL_MS
        : false,
  });
}

export function useContractKpis() {
  return useQuery({
    queryKey: queryKeys.contracts.kpis(),
    queryFn: contractsService.kpis,
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id ?? ""),
    queryFn: () => contractsService.get(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data && CONTRACT_PENDING_STATUSES.includes(query.state.data.status)
        ? POLL_MS
        : false,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["contracts"] });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateContractPayload) => contractsService.create(payload),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Contrato criado — gerando PDF e link de assinatura…");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar contrato."),
  });
}

export function useUpdateContractStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "CANCELADO" | "EXPIRADO" | "AGUARDANDO_ASSINATURA";
    }) => contractsService.updateStatus(id, status),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Status atualizado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar status."),
  });
}

export function useReprocessContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsService.reprocess(id),
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Reprocessamento na fila.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao reprocessar."),
  });
}
