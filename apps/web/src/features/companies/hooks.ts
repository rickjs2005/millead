import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  companiesService,
  type CreateCompanyPayload,
  type ListCompaniesParams,
  type UpdateCompanyPayload,
} from "@/services/companies";
import type { SocialPlatform } from "@/types/api";

export function useCompanies(params: ListCompaniesParams) {
  return useQuery({
    queryKey: queryKeys.companies.list(params),
    queryFn: () => companiesService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id ?? ""),
    queryFn: () => companiesService.get(id!),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCompanyPayload) => companiesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", "list"] });
      toast.success("Empresa criada.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Erro ao criar empresa."),
  });
}

export function useUpdateCompany(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCompanyPayload) => companiesService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(id) });
      queryClient.invalidateQueries({ queryKey: ["companies", "list"] });
      toast.success("Empresa atualizada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar empresa."),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => companiesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies", "list"] });
      toast.success("Empresa excluída.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir empresa."),
  });
}

/** Invalida só o detalhe: websites/socials não aparecem na listagem. */
function useCompanyDetailMutation<TVars>(
  companyId: string,
  mutationFn: (vars: TVars) => Promise<unknown>,
  successMessage: string,
  errorMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(companyId) });
      toast.success(successMessage);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : errorMessage),
  });
}

export function useAddCompanyWebsite(companyId: string) {
  return useCompanyDetailMutation(
    companyId,
    ({ url, isPrimary }: { url: string; isPrimary?: boolean }) =>
      companiesService.addWebsite(companyId, url, isPrimary),
    "Site adicionado.",
    "Erro ao adicionar site.",
  );
}

export function useRemoveCompanyWebsite(companyId: string) {
  return useCompanyDetailMutation(
    companyId,
    (websiteId: string) => companiesService.removeWebsite(companyId, websiteId),
    "Site removido.",
    "Erro ao remover site.",
  );
}

export function useAddCompanySocial(companyId: string) {
  return useCompanyDetailMutation(
    companyId,
    ({ platform, handleOrUrl }: { platform: SocialPlatform; handleOrUrl: string }) =>
      companiesService.addSocial(companyId, platform, handleOrUrl),
    "Rede social adicionada.",
    "Erro ao adicionar rede social.",
  );
}

export function useRemoveCompanySocial(companyId: string) {
  return useCompanyDetailMutation(
    companyId,
    (socialId: string) => companiesService.removeSocial(companyId, socialId),
    "Rede social removida.",
    "Erro ao remover rede social.",
  );
}
