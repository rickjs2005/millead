import { randomBytes } from "node:crypto";
import type { LandingPageKind } from "@millead/database";
import {
  AiNotConfiguredError,
  NotFoundError,
  ValidationError,
} from "../../domain/errors/app-error.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type {
  LandingPageFilters,
  LandingPageRepository,
} from "../../domain/repositories/landing-page-repository.js";
import type { LandingPageQueue } from "../../domain/services/landing-page-queue.js";
import type { PaginationParams } from "../../shared/pagination.js";

export class LandingPageService {
  constructor(
    private readonly pages: LandingPageRepository,
    private readonly companies: CompanyRepository,
    private readonly queue: LandingPageQueue,
    /** IA configurada? Sem chave, criar/regenerar respondem 503. */
    private readonly aiEnabled: boolean,
  ) {}

  private requireAi() {
    if (!this.aiEnabled) throw new AiNotConfiguredError();
  }

  async create(
    organizationId: string,
    createdById: string,
    input: {
      companyId: string;
      leadId?: string;
      kind: LandingPageKind;
      title?: string;
      brief?: string;
    },
  ) {
    this.requireAi();
    const company = await this.companies.findByIdForOrg(input.companyId, organizationId);
    if (!company) throw new NotFoundError("Empresa não encontrada.");

    const page = await this.pages.create({
      organizationId,
      companyId: input.companyId,
      leadId: input.leadId ?? null,
      createdById,
      // 9 bytes -> 12 chars base64url: imprevisível o bastante pra URL pública.
      slug: randomBytes(9).toString("base64url"),
      title: input.title?.trim() || company.name,
      kind: input.kind,
      brief: input.brief ?? null,
    });
    await this.queue.enqueue({ landingPageId: page.id, organizationId });
    return page;
  }

  list(organizationId: string, filters: LandingPageFilters, pagination: PaginationParams) {
    return this.pages.list(organizationId, filters, pagination);
  }

  async get(organizationId: string, id: string) {
    const page = await this.pages.findByIdForOrg(id, organizationId);
    if (!page) throw new NotFoundError("Landing page não encontrada.");
    return page;
  }

  /**
   * Gera de novo (opcionalmente com brief novo). A versão publicada
   * continua no ar até o HTML novo substituir o antigo.
   */
  async regenerate(organizationId: string, id: string, brief?: string) {
    this.requireAi();
    const page = await this.pages.requeue(id, organizationId, brief);
    if (!page) throw new NotFoundError("Landing page não encontrada.");
    await this.queue.enqueue({ landingPageId: page.id, organizationId });
    return page;
  }

  async setPublished(organizationId: string, id: string, published: boolean) {
    const existing = await this.pages.findByIdForOrg(id, organizationId);
    if (!existing) throw new NotFoundError("Landing page não encontrada.");
    if (published && existing.status !== "READY") {
      throw new ValidationError("A página ainda não está pronta pra publicar.");
    }
    const page = await this.pages.setPublished(id, organizationId, published);
    if (!page) throw new NotFoundError("Landing page não encontrada.");
    return page;
  }

  async delete(organizationId: string, id: string) {
    const deleted = await this.pages.delete(id, organizationId);
    if (!deleted) throw new NotFoundError("Landing page não encontrada.");
  }

  /** Rota pública: devolve o HTML e conta a visita. */
  async servePublic(slug: string): Promise<string | null> {
    const page = await this.pages.findPublishedBySlug(slug);
    if (!page || !page.html) return null;
    // Fire-and-forget: contador de views não pode atrasar a resposta.
    void this.pages.incrementViews(page.id).catch(() => {});
    return page.html;
  }
}
