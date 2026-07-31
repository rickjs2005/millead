import type { EstimateStatus } from "@/types/api";

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: "Rascunho",
  READY: "Pronto",
  CONVERTED: "Convertido",
};

export const ESTIMATE_STATUS_VARIANT: Record<
  EstimateStatus,
  "default" | "success" | "secondary" | "destructive" | "warning"
> = {
  DRAFT: "secondary",
  READY: "default",
  CONVERTED: "success",
};
