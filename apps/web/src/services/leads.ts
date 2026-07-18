import { api } from "./api-client";
import type {
  Activity,
  Lead,
  LeadContact,
  LeadDetail,
  LeadFinance,
  LeadNote,
  LeadSource,
  LeadStatus,
  PaginatedResult,
} from "@/types/api";

export interface CreateLeadPayload {
  title: string;
  companyId?: string;
  pipelineStageId?: string;
  ownerId?: string;
  source?: LeadSource;
  value?: string | number;
  currency?: string;
}

export interface UpdateLeadPayload {
  title?: string;
  companyId?: string | null;
  ownerId?: string | null;
  value?: string | number | null;
  currency?: string;
  lostReason?: string | null;
}

export interface ListLeadsParams {
  page?: number;
  pageSize?: number;
  status?: LeadStatus;
  pipelineStageId?: string;
  ownerId?: string;
  companyId?: string;
  search?: string;
}

export const leadsService = {
  list: (params: ListLeadsParams = {}) => api.get<PaginatedResult<Lead>>("/api/v1/leads", params),

  finance: () => api.get<LeadFinance>("/api/v1/leads/finance"),

  recentActivities: () => api.get<Activity[]>("/api/v1/leads/activities/recent"),

  get: (id: string) => api.get<LeadDetail>(`/api/v1/leads/${id}`),

  create: (payload: CreateLeadPayload) => api.post<Lead>("/api/v1/leads", payload),

  update: (id: string, payload: UpdateLeadPayload) =>
    api.patch<Lead>(`/api/v1/leads/${id}`, payload),

  delete: (id: string) => api.delete<void>(`/api/v1/leads/${id}`),

  moveStage: (id: string, pipelineStageId: string) =>
    api.patch<Lead>(`/api/v1/leads/${id}/stage`, { pipelineStageId }),

  addContact: (
    leadId: string,
    input: { name: string; role?: string; email?: string; phone?: string; isPrimary?: boolean },
  ) => api.post<LeadContact>(`/api/v1/leads/${leadId}/contacts`, input),

  removeContact: (leadId: string, contactId: string) =>
    api.delete<void>(`/api/v1/leads/${leadId}/contacts/${contactId}`),

  addNote: (leadId: string, body: string) =>
    api.post<LeadNote>(`/api/v1/leads/${leadId}/notes`, { body }),

  addTag: (leadId: string, tagId: string) =>
    api.post<void>(`/api/v1/leads/${leadId}/tags`, { tagId }),

  removeTag: (leadId: string, tagId: string) =>
    api.delete<void>(`/api/v1/leads/${leadId}/tags/${tagId}`),

  activities: (leadId: string, page = 1, pageSize = 20) =>
    api.get<PaginatedResult<Activity>>(`/api/v1/leads/${leadId}/activities`, { page, pageSize }),
};
