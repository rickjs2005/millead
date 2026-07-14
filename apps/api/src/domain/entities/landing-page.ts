import type { LandingPageKind, LandingPageStatus } from "@millead/database";

export interface LandingPage {
  id: string;
  organizationId: string;
  companyId: string;
  leadId: string | null;
  createdById: string | null;
  slug: string;
  title: string;
  kind: LandingPageKind;
  status: LandingPageStatus;
  brief: string | null;
  html: string | null;
  errorMessage: string | null;
  isPublished: boolean;
  publishedAt: Date | null;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Versão sem o HTML (que pode ter dezenas de KB) pra listagens. */
export type LandingPageSummary = Omit<LandingPage, "html"> & { hasHtml: boolean };
