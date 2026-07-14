import type { ProposalStatus } from "@/types/api";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: "Rascunho",
  SENT: "Enviada",
  VIEWED: "Visualizada",
  ACCEPTED: "Aceita",
  REJECTED: "Rejeitada",
  EXPIRED: "Expirada",
};

export const PROPOSAL_STATUS_VARIANT: Record<
  ProposalStatus,
  "default" | "success" | "secondary" | "destructive" | "warning"
> = {
  DRAFT: "secondary",
  SENT: "default",
  VIEWED: "warning",
  ACCEPTED: "success",
  REJECTED: "destructive",
  EXPIRED: "secondary",
};
