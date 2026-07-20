import { api } from "./api-client";
import type {
  Briefing,
  BriefingDetail,
  BriefingStatus,
  BriefingTemplate,
  BriefingTemplateDetail,
  PaginatedResult,
} from "@/types/api";

export interface CreateBriefingPayload {
  templateKey: string;
  leadId?: string;
  companyId?: string;
}

export type CustomBriefingFieldType =
  "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "URL" | "SELECT" | "MULTI_SELECT" | "FILE";

export interface CustomBriefingFieldInput {
  label: string;
  type: CustomBriefingFieldType;
  required?: boolean;
  helpText?: string;
  options?: string[];
  maxFiles?: number;
}

export interface CreateCustomBriefingPayload {
  title: string;
  description?: string;
  leadId?: string;
  companyId?: string;
  includeContact?: boolean;
  fields: CustomBriefingFieldInput[];
}

export interface ListBriefingsParams {
  page?: number;
  pageSize?: number;
  status?: BriefingStatus;
  search?: string;
  leadId?: string;
}

export const briefingsService = {
  list: (params: ListBriefingsParams = {}) =>
    api.get<PaginatedResult<Briefing>>("/api/v1/briefings", params),

  get: (id: string) => api.get<BriefingDetail>(`/api/v1/briefings/${id}`),

  create: (payload: CreateBriefingPayload) =>
    api.post<Briefing & { link: { token: string } }>("/api/v1/briefings", payload),

  createCustom: (payload: CreateCustomBriefingPayload) =>
    api.post<Briefing & { link: { token: string } }>("/api/v1/briefings/custom", payload),

  archive: (id: string) => api.post<Briefing>(`/api/v1/briefings/${id}/archive`),

  duplicate: (id: string) =>
    api.post<Briefing & { link: { token: string } }>(`/api/v1/briefings/${id}/duplicate`),

  resendEmail: (id: string) => api.post<Briefing>(`/api/v1/briefings/${id}/resend-email`),

  resendWhatsapp: (id: string) => api.post<Briefing>(`/api/v1/briefings/${id}/resend-whatsapp`),

  listTemplates: () => api.get<BriefingTemplate[]>("/api/v1/briefings/templates"),

  getTemplate: (key: string) =>
    api.get<BriefingTemplateDetail>(`/api/v1/briefings/templates/${key}`),
};
