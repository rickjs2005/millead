import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { AuditFilters, AuditRepository } from "../../domain/repositories/audit-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { AuditQueue } from "../../domain/services/audit-queue.js";
import type { PaginationParams } from "../../shared/pagination.js";

export class AuditService {
  constructor(
    private readonly audits: AuditRepository,
    private readonly companies: CompanyRepository,
    private readonly queue: AuditQueue,
  ) {}

  /**
   * Cria a auditoria como QUEUED e enfileira o job -- quem processa é o
   * worker (processo separado). A URL auditada é o site principal da
   * empresa (ou o primeiro cadastrado).
   */
  async request(organizationId: string, requestedById: string, companyId: string) {
    const company = await this.companies.findByIdForOrg(companyId, organizationId);
    if (!company) throw new NotFoundError("Empresa não encontrada.");

    const website = company.websites.find((w) => w.isPrimary) ?? company.websites[0];
    if (!website) {
      throw new ValidationError(
        "A empresa não tem site cadastrado. Adicione um site antes de auditar.",
      );
    }

    const audit = await this.audits.create({
      organizationId,
      companyId,
      requestedById,
      triggeredBy: "MANUAL",
    });
    await this.queue.enqueue({ auditId: audit.id, organizationId, url: website.url });
    return audit;
  }

  async get(organizationId: string, id: string) {
    const audit = await this.audits.findByIdForOrg(id, organizationId);
    if (!audit) throw new NotFoundError("Auditoria não encontrada.");
    return audit;
  }

  list(organizationId: string, filters: AuditFilters, pagination: PaginationParams) {
    return this.audits.list(organizationId, filters, pagination);
  }
}
