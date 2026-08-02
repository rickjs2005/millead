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
  // publicToken não entra aqui de propósito -- só é gravado via
  // ensurePublicToken (compare-and-set), pra não haver dois caminhos de
  // escrita concorrentes pro mesmo campo único.
  viewedAt?: Date | null;
  decidedAt?: Date | null;
  decisionIp?: string | null;
  rejectReason?: string | null;
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
  /**
   * Compare-and-set: grava `token` só se `publicToken` ainda for null.
   * Devolve o token efetivamente persistido -- o desta chamada, ou o de
   * outra chamada concorrente que já tenha vencido a corrida. `null` só
   * quando a proposta não existe (id/organizationId não batem).
   */
  ensurePublicToken(id: string, organizationId: string, token: string): Promise<string | null>;
  /** Cleanup do fluxo de conversão orçamento→proposta: some se o PDF/upload falhar após criar a proposal. */
  delete(id: string, organizationId: string): Promise<boolean>;
}
