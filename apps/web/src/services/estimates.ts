import { api } from "./api-client";
import type {
  ConvertEstimateResult,
  EstimatesListResult,
  EstimatePayload,
  EstimateStatus,
  PricingEstimate,
  ProjectProduct,
} from "@/types/api";

export interface ListEstimatesParams {
  page?: number;
  pageSize?: number;
  status?: EstimateStatus;
}

export const estimatesService = {
  list: (params: ListEstimatesParams = {}) =>
    api.get<EstimatesListResult>("/api/v1/estimates", params),
  get: (id: string) => api.get<PricingEstimate>(`/api/v1/estimates/${id}`),
  create: (payload: EstimatePayload) => api.post<PricingEstimate>("/api/v1/estimates", payload),
  update: (id: string, payload: Partial<EstimatePayload>) =>
    api.patch<PricingEstimate>(`/api/v1/estimates/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/estimates/${id}`),
  products: () => api.get<ProjectProduct[]>("/api/v1/estimates/products"),
  // Fase 6: `price` fica opcional -- SEM body a API resolve a cascata
  // finalPrice salvo -> preço recomendado (EstimateService.convert). O corpo
  // `{}` (em vez de omitir por completo) evita ambiguidade de parsing do lado
  // do Express com Content-Type: application/json e corpo vazio.
  /**
   * Prévia do PDF do cliente, sem converter. Mesmo caminho do PDF de
   * contrato: o token está em cookie httpOnly, então o BFF anexa o Bearer no
   * servidor; num 401 tenta refresh e repete uma vez.
   */
  async openPreviewPdf(id: string): Promise<void> {
    const url = `/api/bff/api/v1/estimates/${id}/preview-pdf`;
    let res = await fetch(url, { credentials: "include" });
    if (res.status === 401) {
      const refreshed = await fetch("/api/bff/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (refreshed.ok) res = await fetch(url, { credentials: "include" });
    }
    if (!res.ok) throw new Error("Não foi possível gerar a prévia.");
    window.open(URL.createObjectURL(await res.blob()), "_blank");
  },

  convert: (id: string) => api.post<ConvertEstimateResult>(`/api/v1/estimates/${id}/convert`, {}),
};
