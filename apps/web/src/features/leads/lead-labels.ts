import type { LeadSource, LeadStatus } from "@/types/api";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  OPEN: "Aberto",
  WON: "Ganho",
  LOST: "Perdido",
};

export const LEAD_STATUS_VARIANT: Record<LeadStatus, "default" | "success" | "destructive"> = {
  OPEN: "default",
  WON: "success",
  LOST: "destructive",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  MANUAL: "Manual",
  IMPORT: "Importação",
  SCRAPER: "Prospecção automática",
  REFERRAL: "Indicação",
  INBOUND: "Inbound",
};
