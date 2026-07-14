import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  proposalsService,
  type CreateProposalPayload,
  type ListProposalsParams,
  type UpdateProposalPayload,
} from "@/services/proposals";

export function useProposals(params: ListProposalsParams) {
  return useQuery({
    queryKey: queryKeys.proposals.list(params),
    queryFn: () => proposalsService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProposalPayload) => proposalsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals", "list"] });
      toast.success("Proposta criada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar proposta."),
  });
}

export function useUpdateProposal(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProposalPayload) => proposalsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals", "list"] });
      toast.success("Proposta atualizada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar proposta."),
  });
}
