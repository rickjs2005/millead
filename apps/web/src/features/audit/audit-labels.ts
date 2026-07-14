import {
  Accessibility,
  Gauge,
  Palette,
  Search,
  Shield,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import type { AuditScoreCategory, AuditStatus } from "@/types/api";

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  QUEUED: "Na fila",
  RUNNING: "Analisando…",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
};

export const AUDIT_STATUS_VARIANT: Record<
  AuditStatus,
  "default" | "success" | "secondary" | "destructive"
> = {
  QUEUED: "secondary",
  RUNNING: "default",
  COMPLETED: "success",
  FAILED: "destructive",
};

export const AUDIT_CATEGORY_LABELS: Record<AuditScoreCategory, string> = {
  PERFORMANCE: "Performance",
  SEO: "SEO",
  ACCESSIBILITY: "Acessibilidade",
  SECURITY: "Segurança",
  MOBILE: "Mobile",
  DESIGN: "Design",
};

export const AUDIT_CATEGORY_ICONS: Record<AuditScoreCategory, LucideIcon> = {
  PERFORMANCE: Gauge,
  SEO: Search,
  ACCESSIBILITY: Accessibility,
  SECURITY: Shield,
  MOBILE: Smartphone,
  DESIGN: Palette,
};

/** Ordem fixa de exibição das categorias. */
export const AUDIT_CATEGORY_ORDER: AuditScoreCategory[] = [
  "PERFORMANCE",
  "SEO",
  "ACCESSIBILITY",
  "SECURITY",
  "MOBILE",
  "DESIGN",
];

/** Verde >= 80, amarelo >= 50, vermelho abaixo -- mesma régua do Lighthouse. */
export function scoreColorClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

export function overallScore(scores: Array<{ score: number }>): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
}
