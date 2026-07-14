import type { ProposalStatus } from "@millead/database";
import type { Proposal } from "../entities/proposal.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateProposalInput {
  organizationId: string;
  leadId: string;
  createdById?: string | null;
  title: string;
  value: string;
  currency?: string;
  validUntil?: Date | null;
  pdfUrl?: string | null;
}

export interface UpdateProposalInput {
  title?: string;
  value?: string;
  currency?: string;
  validUntil?: Date | null;
  pdfUrl?: string | null;
  status?: ProposalStatus;
  sentAt?: Date | null;
  respondedAt?: Date | null;
}

export interface ProposalFilters {
  leadId?: string;
  status?: ProposalStatus;
}

export interface ProposalRepository {
  create(input: CreateProposalInput): Promise<Proposal>;
  findByIdForOrg(id: string, organizationId: string): Promise<Proposal | null>;
  list(
    organizationId: string,
    filters: ProposalFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Proposal>>;
  update(id: string, organizationId: string, patch: UpdateProposalInput): Promise<Proposal | null>;
}
