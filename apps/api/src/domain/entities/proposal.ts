import type { ProposalStatus } from "@millead/database";

export interface Proposal {
  id: string;
  organizationId: string;
  leadId: string;
  createdById: string | null;
  title: string;
  status: ProposalStatus;
  value: string; // Decimal do Prisma serializa como string
  currency: string;
  validUntil: Date | null;
  pdfUrl: string | null;
  sentAt: Date | null;
  respondedAt: Date | null;
  // Aceite público (/p/:token)
  publicToken: string | null;
  viewedAt: Date | null;
  decidedAt: Date | null;
  decisionIp: string | null;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}
