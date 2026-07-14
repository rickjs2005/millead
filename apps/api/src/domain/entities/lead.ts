import type { LeadSource, LeadStatus } from "@millead/database";

export interface Lead {
  id: string;
  organizationId: string;
  companyId: string | null;
  pipelineStageId: string | null;
  ownerId: string | null;
  title: string;
  source: LeadSource;
  status: LeadStatus;
  score: number | null;
  value: string | null; // Decimal do Prisma serializa como string
  currency: string;
  lostReason: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadContact {
  id: string;
  leadId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string | null;
  body: string;
  createdAt: Date;
}

export interface LeadTagRef {
  id: string;
  name: string;
  color: string;
}

export interface LeadDetail extends Lead {
  contacts: LeadContact[];
  notes: LeadNote[];
  tags: LeadTagRef[];
}
