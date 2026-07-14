import type { SocialPlatform } from "@millead/database";
import { NotFoundError } from "../../domain/errors/app-error.js";
import type {
  CompanyFilters,
  CompanyRepository,
  UpdateCompanyInput,
} from "../../domain/repositories/company-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { CreateCompanyInput as CreateCompanyDto } from "../dto/company.dto.js";

/**
 * CRUD sem lógica de negócio própria além de "existe e é deste tenant?" --
 * por isso é um Service de aplicação (um método por operação) em vez de
 * uma classe de use-case por operação (ver nota em docs/ARCHITECTURE.md
 * sobre quando cada estilo se aplica).
 */
export class CompanyService {
  constructor(private readonly repository: CompanyRepository) {}

  async create(organizationId: string, input: CreateCompanyDto) {
    return this.repository.create({ organizationId, ...input });
  }

  async get(organizationId: string, id: string) {
    const company = await this.repository.findByIdForOrg(id, organizationId);
    if (!company) throw new NotFoundError("Empresa não encontrada.");
    return company;
  }

  async list(organizationId: string, filters: CompanyFilters, pagination: PaginationParams) {
    return this.repository.list(organizationId, filters, pagination);
  }

  async update(organizationId: string, id: string, patch: UpdateCompanyInput) {
    const updated = await this.repository.update(id, organizationId, patch);
    if (!updated) throw new NotFoundError("Empresa não encontrada.");
    return updated;
  }

  async addWebsite(organizationId: string, companyId: string, url: string, isPrimary?: boolean) {
    const website = await this.repository.addWebsite(companyId, organizationId, { url, isPrimary });
    if (!website) throw new NotFoundError("Empresa não encontrada.");
    return website;
  }

  async removeWebsite(organizationId: string, companyId: string, websiteId: string) {
    const removed = await this.repository.removeWebsite(websiteId, companyId, organizationId);
    if (!removed) throw new NotFoundError("Site não encontrado.");
  }

  async addSocial(
    organizationId: string,
    companyId: string,
    platform: SocialPlatform,
    handleOrUrl: string,
  ) {
    const social = await this.repository.addSocial(companyId, organizationId, {
      platform,
      handleOrUrl,
    });
    if (!social) throw new NotFoundError("Empresa não encontrada.");
    return social;
  }

  async removeSocial(organizationId: string, companyId: string, socialId: string) {
    const removed = await this.repository.removeSocial(socialId, companyId, organizationId);
    if (!removed) throw new NotFoundError("Rede social não encontrada.");
  }
}
