import type { MessageChannel } from "@millead/database";
import { AiNotConfiguredError, NotFoundError } from "../../domain/errors/app-error.js";
import type { AuditRepository } from "../../domain/repositories/audit-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { MessageRepository } from "../../domain/repositories/message-repository.js";
import type { MessageTemplateRepository } from "../../domain/repositories/message-template-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";
import type { LeadAi, LeadAiContext } from "../../domain/services/lead-ai.js";
import type { ActivityLogger } from "./activity-logger.js";

export class AiService {
  constructor(
    /** null quando ANTHROPIC_API_KEY não está configurada. */
    private readonly leadAi: LeadAi | null,
    private readonly leads: LeadRepository,
    private readonly companies: CompanyRepository,
    private readonly audits: AuditRepository,
    private readonly pipelines: PipelineRepository,
    private readonly organizations: OrganizationRepository,
    private readonly templates: MessageTemplateRepository,
    private readonly messages: MessageRepository,
    private readonly activityLogger: ActivityLogger,
  ) {}

  status() {
    return { enabled: this.leadAi !== null };
  }

  private requireAi(): LeadAi {
    if (!this.leadAi) throw new AiNotConfiguredError();
    return this.leadAi;
  }

  /** Junta lead + empresa + auditoria + atividades num contexto pro modelo. */
  private async buildContext(organizationId: string, leadId: string): Promise<LeadAiContext> {
    const lead = await this.leads.findByIdForOrg(leadId, organizationId);
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    const [organization, company, stage, activities] = await Promise.all([
      this.organizations.findById(organizationId),
      lead.companyId
        ? this.companies.findByIdForOrg(lead.companyId, organizationId)
        : Promise.resolve(null),
      lead.pipelineStageId
        ? this.pipelines.findStageForOrg(lead.pipelineStageId, organizationId)
        : Promise.resolve(null),
      this.activityLogger.listForLead(organizationId, leadId, { page: 1, pageSize: 10 }),
    ]);

    const stageName = stage?.name ?? null;

    let audit: LeadAiContext["audit"] = null;
    if (lead.companyId) {
      const latest = await this.audits.list(
        organizationId,
        { companyId: lead.companyId, status: "COMPLETED" },
        { page: 1, pageSize: 1 },
      );
      const found = latest.items[0];
      if (found) {
        audit = {
          summary: found.report?.summary ?? null,
          completedAt: found.completedAt,
          scores: found.scores.map((s) => ({ category: s.category, score: s.score })),
        };
      }
    }

    return {
      lead: {
        title: lead.title,
        status: lead.status,
        stageName,
        value: lead.value,
        currency: lead.currency,
        source: lead.source,
        createdAt: lead.createdAt,
        contacts: lead.contacts.map((c) => ({ name: c.name, role: c.role, email: c.email })),
        tags: lead.tags.map((t) => t.name),
        recentNotes: lead.notes.slice(0, 5).map((n) => n.body),
      },
      company: company
        ? {
            name: company.name,
            segment: company.segment,
            sizeEstimate: company.sizeEstimate,
            city: company.city,
            state: company.state,
            websites: company.websites.map((w) => w.url),
            socials: company.socials.map((s) => ({
              platform: s.platform,
              handleOrUrl: s.handleOrUrl,
            })),
            notes: company.notes,
          }
        : null,
      audit,
      recentActivities: activities.items.map((a) => ({ type: a.type, createdAt: a.createdAt })),
      organizationName: organization?.name ?? "MilLead",
    };
  }

  /** Calcula e persiste o score; a justificativa vai pra timeline do lead. */
  async scoreLead(organizationId: string, userId: string, leadId: string) {
    const ai = this.requireAi();
    const context = await this.buildContext(organizationId, leadId);
    const result = await ai.scoreLead(context);

    const lead = await this.leads.updateScore(leadId, organizationId, result.score);
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    await this.activityLogger.log(organizationId, leadId, userId, "OTHER", {
      kind: "AI_SCORE",
      score: result.score,
      rationale: result.rationale,
    });

    return { score: result.score, rationale: result.rationale, lead };
  }

  /** Gera o relatório executivo (não persiste -- o front decide salvar como nota). */
  async reportLead(organizationId: string, leadId: string) {
    const ai = this.requireAi();
    const context = await this.buildContext(organizationId, leadId);
    const report = await ai.reportLead(context);
    return { report };
  }

  /** Gera um rascunho de mensagem e salva como Message DRAFT na caixa do lead. */
  async draftMessage(
    organizationId: string,
    userId: string,
    leadId: string,
    input: { channel: MessageChannel; templateId?: string; instructions?: string },
  ) {
    const ai = this.requireAi();

    let templateBody: string | undefined;
    if (input.templateId) {
      const template = await this.templates.findByIdForOrg(input.templateId, organizationId);
      if (!template) throw new NotFoundError("Modelo de mensagem não encontrado.");
      templateBody = template.body;
    }

    const context = await this.buildContext(organizationId, leadId);
    const body = await ai.draftMessage(context, {
      channel: input.channel,
      instructions: input.instructions,
      templateBody,
    });

    return this.messages.create({
      organizationId,
      leadId,
      templateId: input.templateId ?? null,
      channel: input.channel,
      body,
    });
  }
}
