import { api } from "./api-client";
import type {
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
};
