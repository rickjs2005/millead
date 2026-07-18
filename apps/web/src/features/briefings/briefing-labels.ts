import type { BriefingStatus, BriefingTemplateKind } from "@/types/api";

export const BRIEFING_STATUS_LABELS: Record<BriefingStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em preenchimento",
  COMPLETED: "Concluído",
  ARCHIVED: "Arquivado",
};

export const BRIEFING_STATUS_VARIANT: Record<
  BriefingStatus,
  "default" | "success" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "success",
  ARCHIVED: "outline",
};

export const BRIEFING_TEMPLATE_KIND_LABELS: Record<BriefingTemplateKind, string> = {
  INSTITUCIONAL: "Site Institucional",
  ECOMMERCE: "Loja Virtual",
};

/** Status em que o cliente ainda pode estar preenchendo -- a UI faz polling. */
export const BRIEFING_ACTIVE_STATUSES: BriefingStatus[] = ["PENDING", "IN_PROGRESS"];
