import type { LandingPageKind, LandingPageStatus } from "@millead/database";
import type { LandingPage, LandingPageSummary } from "../entities/landing-page.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateLandingPageInput {
  organizationId: string;
  companyId: string;
  leadId?: string | null;
  createdById?: string | null;
  slug: string;
  title: string;
  kind: LandingPageKind;
  brief?: string | null;
}

export interface LandingPageFilters {
  companyId?: string;
  status?: LandingPageStatus;
}

export interface LandingPageRepository {
  create(input: CreateLandingPageInput): Promise<LandingPage>;
  findByIdForOrg(id: string, organizationId: string): Promise<LandingPage | null>;
  list(
    organizationId: string,
    filters: LandingPageFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LandingPageSummary>>;
  markGenerating(id: string): Promise<void>;
  /** Idempotente: retry do job sobrescreve o HTML anterior. */
  saveHtml(id: string, html: string): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
  /** Reenfileiramento: volta pra QUEUED e atualiza o brief se fornecido. */
  requeue(id: string, organizationId: string, brief?: string | null): Promise<LandingPage | null>;
  setPublished(id: string, organizationId: string, published: boolean): Promise<LandingPage | null>;
  delete(id: string, organizationId: string): Promise<boolean>;
  /** Rota pública: só páginas publicadas; incrementa views. */
  findPublishedBySlug(slug: string): Promise<LandingPage | null>;
  incrementViews(id: string): Promise<void>;
}
