import type { SocialPlatform } from "@millead/database";
import type { Company, CompanyDetail, CompanySocial, CompanyWebsite } from "../entities/company.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateCompanyInput {
  organizationId: string;
  name: string;
  document?: string | null;
  segment?: string | null;
  sizeEstimate?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export type UpdateCompanyInput = Partial<Omit<CreateCompanyInput, "organizationId">>;

export interface CompanyFilters {
  /** Busca livre por nome ou documento. */
  search?: string;
}

/** Contrato é `onDelete: Restrict` no schema -- ver DeleteLeadResult pro motivo do check antes de apagar. */
export type DeleteCompanyResult =
  { status: "deleted" } | { status: "not_found" } | { status: "blocked"; contracts: number };

export interface CompanyRepository {
  create(input: CreateCompanyInput): Promise<Company>;
  findByIdForOrg(id: string, organizationId: string): Promise<CompanyDetail | null>;
  /** Busca por CPF/CNPJ (só dígitos) dentro da org -- usado pelo fluxo de contratos. */
  findByDocumentForOrg(document: string, organizationId: string): Promise<Company | null>;
  list(
    organizationId: string,
    filters: CompanyFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Company>>;
  update(id: string, organizationId: string, patch: UpdateCompanyInput): Promise<Company | null>;
  delete(id: string, organizationId: string): Promise<DeleteCompanyResult>;

  addWebsite(
    companyId: string,
    organizationId: string,
    input: { url: string; isPrimary?: boolean },
  ): Promise<CompanyWebsite | null>;
  removeWebsite(id: string, companyId: string, organizationId: string): Promise<boolean>;

  addSocial(
    companyId: string,
    organizationId: string,
    input: { platform: SocialPlatform; handleOrUrl: string },
  ): Promise<CompanySocial | null>;
  removeSocial(id: string, companyId: string, organizationId: string): Promise<boolean>;
}
