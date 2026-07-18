import { api } from "./api-client";
import type {
  Company,
  CompanyDetail,
  CompanySocial,
  CompanyWebsite,
  PaginatedResult,
  SocialPlatform,
} from "@/types/api";

export interface CreateCompanyPayload {
  name: string;
  document?: string;
  segment?: string;
  sizeEstimate?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

export interface ListCompaniesParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const companiesService = {
  list: (params: ListCompaniesParams = {}) =>
    api.get<PaginatedResult<Company>>("/api/v1/companies", params),

  get: (id: string) => api.get<CompanyDetail>(`/api/v1/companies/${id}`),

  create: (payload: CreateCompanyPayload) => api.post<Company>("/api/v1/companies", payload),

  update: (id: string, payload: UpdateCompanyPayload) =>
    api.patch<Company>(`/api/v1/companies/${id}`, payload),

  delete: (id: string) => api.delete<void>(`/api/v1/companies/${id}`),

  addWebsite: (companyId: string, url: string, isPrimary?: boolean) =>
    api.post<CompanyWebsite>(`/api/v1/companies/${companyId}/websites`, { url, isPrimary }),

  removeWebsite: (companyId: string, websiteId: string) =>
    api.delete<void>(`/api/v1/companies/${companyId}/websites/${websiteId}`),

  addSocial: (companyId: string, platform: SocialPlatform, handleOrUrl: string) =>
    api.post<CompanySocial>(`/api/v1/companies/${companyId}/socials`, { platform, handleOrUrl }),

  removeSocial: (companyId: string, socialId: string) =>
    api.delete<void>(`/api/v1/companies/${companyId}/socials/${socialId}`),
};
