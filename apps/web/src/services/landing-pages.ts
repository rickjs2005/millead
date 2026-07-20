import { api } from "./api-client";
import type { LandingPage, LandingPageKind, LandingPageStatus, PaginatedResult } from "@/types/api";

export interface CreateLandingPagePayload {
  companyId: string;
  leadId?: string;
  kind: LandingPageKind;
  title?: string;
  brief?: string;
}

export interface ListLandingPagesParams {
  page?: number;
  pageSize?: number;
  companyId?: string;
  status?: LandingPageStatus;
}

export const landingPagesService = {
  list: (params: ListLandingPagesParams = {}) =>
    api.get<PaginatedResult<LandingPage>>("/api/v1/landing-pages", params),

  get: (id: string) => api.get<LandingPage>(`/api/v1/landing-pages/${id}`),

  create: (payload: CreateLandingPagePayload) =>
    api.post<LandingPage>("/api/v1/landing-pages", payload),

  regenerate: (id: string, brief?: string) =>
    api.post<LandingPage>(`/api/v1/landing-pages/${id}/regenerate`, { brief }),

  publish: (id: string, published: boolean) =>
    api.post<LandingPage>(`/api/v1/landing-pages/${id}/publish`, { published }),

  delete: (id: string) => api.delete<void>(`/api/v1/landing-pages/${id}`),
};

/** URL pública que o prospect abre (servida pela API, sem login). */
export function publicLandingPageUrl(slug: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return `${base}/p/${slug}`;
}
