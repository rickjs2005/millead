import type { AuditRepository } from "../../domain/repositories/audit-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { LandingPageRepository } from "../../domain/repositories/landing-page-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type {
  LandingPageContext,
  LandingPageGenerator,
} from "../../domain/services/landing-page-generator.js";

/**
 * Executa a geração de uma landing page -- chamado SOMENTE pelo worker
 * BullMQ (interfaces/jobs/landing-page.worker.ts).
 */
export class LandingPageRunner {
  constructor(
    private readonly pages: LandingPageRepository,
    private readonly companies: CompanyRepository,
    private readonly audits: AuditRepository,
    private readonly organizations: OrganizationRepository,
    /** null quando ANTHROPIC_API_KEY não está configurada. */
    private readonly generator: LandingPageGenerator | null,
  ) {}

  async run(landingPageId: string, organizationId: string): Promise<void> {
    const page = await this.pages.findByIdForOrg(landingPageId, organizationId);
    if (!page) throw new Error(`landing page ${landingPageId} não encontrada`);

    if (!this.generator) {
      await this.pages.markFailed(
        landingPageId,
        "IA não configurada no servidor (ANTHROPIC_API_KEY ausente).",
      );
      return;
    }

    await this.pages.markGenerating(landingPageId);
    try {
      const [company, organization, latestAudit] = await Promise.all([
        this.companies.findByIdForOrg(page.companyId, organizationId),
        this.organizations.findById(organizationId),
        this.audits.list(
          organizationId,
          { companyId: page.companyId, status: "COMPLETED" },
          { page: 1, pageSize: 1 },
        ),
      ]);
      if (!company) throw new Error("empresa da landing page não existe mais");

      const audit = latestAudit.items[0];
      const context: LandingPageContext = {
        kind: page.kind,
        title: page.title,
        brief: page.brief,
        organizationName: organization?.name ?? "MilLead",
        company: {
          name: company.name,
          segment: company.segment,
          sizeEstimate: company.sizeEstimate,
          city: company.city,
          state: company.state,
          phone: company.phone,
          email: company.email,
          websites: company.websites.map((w) => w.url),
          socials: company.socials.map((s) => ({
            platform: s.platform,
            handleOrUrl: s.handleOrUrl,
          })),
          notes: company.notes,
        },
        audit: audit
          ? {
              summary: audit.report?.summary ?? null,
              scores: audit.scores.map((s) => ({ category: s.category, score: s.score })),
            }
          : null,
      };

      const html = await this.generator.generate(context);
      await this.pages.saveHtml(landingPageId, html);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha desconhecida na geração.";
      await this.pages.markFailed(landingPageId, message);
      throw err;
    }
  }
}
