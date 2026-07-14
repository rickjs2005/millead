import type { AuditScoreCategory, AuditStatus, AuditTrigger } from "@millead/database";
import type { Audit, AuditWithResults } from "../entities/audit.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateAuditInput {
  organizationId: string;
  companyId: string;
  requestedById?: string | null;
  triggeredBy?: AuditTrigger;
}

export interface AuditFilters {
  companyId?: string;
  status?: AuditStatus;
}

export interface AuditResultInput {
  summary: string;
  rawData: unknown;
  scores: Array<{ category: AuditScoreCategory; score: number; details?: unknown }>;
}

export interface AuditRepository {
  create(input: CreateAuditInput): Promise<Audit>;
  findByIdForOrg(id: string, organizationId: string): Promise<AuditWithResults | null>;
  list(
    organizationId: string,
    filters: AuditFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<AuditWithResults>>;
  markRunning(id: string): Promise<void>;
  /** Idempotente (upsert do report, replace dos scores) -- retry do worker não pode quebrar. */
  saveResult(id: string, result: AuditResultInput): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
}
