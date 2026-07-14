import type { SocialPlatform } from "@millead/database";

export interface Company {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  segment: string | null;
  sizeEstimate: string | null;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyWebsite {
  id: string;
  companyId: string;
  url: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface CompanySocial {
  id: string;
  companyId: string;
  platform: SocialPlatform;
  handleOrUrl: string;
  createdAt: Date;
}

export interface CompanyDetail extends Company {
  websites: CompanyWebsite[];
  socials: CompanySocial[];
}
