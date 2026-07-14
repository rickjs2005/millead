import type { AuditScoreCategory } from "@millead/database";

/** Uma checagem individual dentro de uma categoria (explicável na UI). */
export interface AuditCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Peso relativo dentro da categoria (score = % ponderado dos aprovados). */
  weight: number;
  /** Detalhe livre pra UI ("respondeu em 320ms", "faltam 3 alts"...). */
  info?: string;
}

export interface AuditCategoryResult {
  category: AuditScoreCategory;
  score: number; // 0-100
  checks: AuditCheck[];
}

export interface SiteAuditResult {
  url: string;
  finalUrl: string;
  httpStatus: number;
  responseTimeMs: number;
  summary: string;
  categories: AuditCategoryResult[];
  /** Dump bruto pro AuditReport.rawData (headers, contagens etc.). */
  rawData: unknown;
}

/** Porta do motor de análise -- a implementação HTTP vive em infrastructure/audit. */
export interface SiteAuditor {
  audit(url: string): Promise<SiteAuditResult>;
}
