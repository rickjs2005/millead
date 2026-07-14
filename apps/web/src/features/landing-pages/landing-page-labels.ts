import type { LandingPageKind, LandingPageStatus } from "@/types/api";

export const LANDING_PAGE_KIND_LABELS: Record<LandingPageKind, string> = {
  DEMO_SITE: "Demo do site",
  PITCH: "Página de proposta",
};

export const LANDING_PAGE_STATUS_LABELS: Record<LandingPageStatus, string> = {
  QUEUED: "Na fila",
  GENERATING: "Gerando…",
  READY: "Pronta",
  FAILED: "Falhou",
};

export const LANDING_PAGE_STATUS_VARIANT: Record<
  LandingPageStatus,
  "default" | "success" | "secondary" | "destructive"
> = {
  QUEUED: "secondary",
  GENERATING: "default",
  READY: "success",
  FAILED: "destructive",
};
