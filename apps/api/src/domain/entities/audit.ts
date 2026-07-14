import type { AuditScoreCategory, AuditStatus, AuditTrigger } from "@millead/database";

/**
 * Auditoria de SITE (feature de produto, Fase 6) -- não confundir com
 * `AuditLog`, que é a trilha de segurança de ações do sistema.
 */
export interface Audit {
  id: string;
  organizationId: string;
  companyId: string;
  requestedById: string | null;
  status: AuditStatus;
  triggeredBy: AuditTrigger;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

export interface AuditScore {
  id: string;
  organizationId: string;
  auditId: string;
  category: AuditScoreCategory;
  score: number;
  details: unknown;
  createdAt: Date;
}

export interface AuditReport {
  id: string;
  organizationId: string;
  auditId: string;
  summary: string | null;
  rawData: unknown;
  pdfUrl: string | null;
  createdAt: Date;
}

export interface AuditWithResults extends Audit {
  report: AuditReport | null;
  scores: AuditScore[];
}
