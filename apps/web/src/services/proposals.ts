import { api } from "./api-client";
import type { PaginatedResult, Proposal, ProposalStatus } from "@/types/api";

export interface CreateProposalPayload {
  leadId: string;
  title: string;
  value: string | number;
  currency?: string;
  validUntil?: string;
  pdfUrl?: string;
}

export interface UpdateProposalPayload {
  title?: string;
  value?: string | number;
  currency?: string;
  validUntil?: string | null;
  pdfUrl?: string | null;
  status?: ProposalStatus;
}

export interface ListProposalsParams {
  page?: number;
  pageSize?: number;
  leadId?: string;
  status?: ProposalStatus;
}

export const proposalsService = {
  list: (params: ListProposalsParams = {}) =>
    api.get<PaginatedResult<Proposal>>("/api/v1/proposals", params),
  get: (id: string) => api.get<Proposal>(`/api/v1/proposals/${id}`),
  create: (payload: CreateProposalPayload) => api.post<Proposal>("/api/v1/proposals", payload),
  update: (id: string, payload: UpdateProposalPayload) =>
    api.patch<Proposal>(`/api/v1/proposals/${id}`, payload),
};
