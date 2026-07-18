import { randomInt } from "node:crypto";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  BriefingFilters,
  BriefingRepository,
} from "../../domain/repositories/briefing-repository.js";
import type { BriefingTemplateRepository } from "../../domain/repositories/briefing-template-repository.js";
import type { BriefingNotifier } from "../../domain/services/briefing-notifier.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { ActivityLogger } from "./activity-logger.js";

// Sem O/0/I/1 -- evita confusão caso o cliente precise ler o código.
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Token do link público (/b/:token). 20 chars sobre alfabeto de 32 ≈ 100
 * bits de entropia -- o link protege PII do lead/empresa e permite gerar
 * tokens de upload no escopo da org, então precisa ser imprevisível, não só
 * "único". Antes eram 6 chars (~1bi), enumerável. O link é enviado por
 * WhatsApp/e-mail (copiado, não digitado), então o comprimento não atrapalha.
 */
function generatePublicToken(length = 20): string {
  let token = "";
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)];
  }
  return token;
}

export class BriefingService {
  constructor(
    private readonly briefings: BriefingRepository,
    private readonly templates: BriefingTemplateRepository,
    private readonly notifier: BriefingNotifier,
    private readonly activityLogger: ActivityLogger,
  ) {}

  /** Token único: gera e tenta de novo na (agora improvável) colisão. */
  private async generateUniqueToken(): Promise<string> {
    let token = generatePublicToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.briefings.findByToken(token);
      if (!existing) break;
      token = generatePublicToken();
    }
    return token;
  }

  async create(
    organizationId: string,
    createdById: string | null,
    input: { templateKey: string; leadId?: string | null; companyId?: string | null },
  ) {
    const template = await this.templates.findByKey(input.templateKey);
    if (!template) throw new ValidationError(`Template "${input.templateKey}" não encontrado.`);

    const token = await this.generateUniqueToken();
    const briefing = await this.briefings.create({
      organizationId,
      templateId: template.id,
      leadId: input.leadId ?? null,
      companyId: input.companyId ?? null,
      createdById,
      token,
    });

    if (input.leadId) {
      await this.activityLogger.log(organizationId, input.leadId, createdById, "BRIEFING_SENT", {
        briefingId: briefing.id,
        templateKind: template.kind,
      });
    }

    return briefing;
  }

  list(organizationId: string, filters: BriefingFilters, pagination: PaginationParams) {
    return this.briefings.list(organizationId, filters, pagination);
  }

  async get(organizationId: string, id: string) {
    const briefing = await this.briefings.findByIdForOrg(id, organizationId);
    if (!briefing) throw new NotFoundError("Briefing não encontrado.");
    return briefing;
  }

  async archive(organizationId: string, id: string) {
    // valida tenant ANTES de mutar -- updateStatus(id) sozinho não filtra
    // por organizationId (mesmo padrão do ContractRepository: métodos só-id
    // presumem que o chamador já resolveu o registro por um fetch com
    // escopo de organização; nunca aceitar um id cru sem essa checagem antes).
    const existing = await this.briefings.findByIdForOrg(id, organizationId);
    if (!existing) throw new NotFoundError("Briefing não encontrado.");

    const briefing = await this.briefings.updateStatus(id, "ARCHIVED", { archivedAt: new Date() });
    if (!briefing) throw new NotFoundError("Briefing não encontrado.");
    await this.briefings.revokeLink(id, organizationId);
    await this.briefings.addHistory(id, organizationId, "ARQUIVADO", "APP");
    return briefing;
  }

  async duplicate(organizationId: string, createdById: string | null, id: string) {
    const existing = await this.briefings.findByIdForOrg(id, organizationId);
    if (!existing) throw new NotFoundError("Briefing não encontrado.");
    const token = await this.generateUniqueToken();
    const copy = await this.briefings.duplicate(id, organizationId, createdById, token);
    await this.briefings.addHistory(copy.id, organizationId, "DUPLICADO_DE", "APP", {
      originalId: id,
    });
    return copy;
  }

  /** Reenvia a notificação de conclusão (PDF já gerado) -- só se COMPLETED. */
  async resend(organizationId: string, id: string, channel: "email" | "whatsapp") {
    const briefing = await this.briefings.findByIdForOrg(id, organizationId);
    if (!briefing) throw new NotFoundError("Briefing não encontrado.");
    if (briefing.status !== "COMPLETED" || !briefing.pdfUrl) {
      throw new ValidationError("Só é possível reenviar um briefing já concluído.");
    }
    const title = `${briefing.template.name} — ${briefing.contactName ?? "sem nome"}`;
    if (channel === "email") {
      await this.notifier.notificarConclusaoAdmin({
        briefingTitle: title,
        contactName: briefing.contactName,
        contactEmail: briefing.contactEmail,
        pdfUrl: briefing.pdfUrl,
      });
    } else if (briefing.contactPhone) {
      await this.notifier.notificarConclusaoWhatsapp({
        telefone: briefing.contactPhone,
        briefingTitle: title,
        contactName: briefing.contactName,
        pdfUrl: briefing.pdfUrl,
      });
    }
    await this.briefings.addHistory(id, organizationId, `REENVIADO_${channel.toUpperCase()}`, "APP");
    return briefing;
  }

  listTemplates() {
    return this.templates.list();
  }

  async getTemplate(key: string) {
    const template = await this.templates.findByKey(key);
    if (!template) throw new NotFoundError("Template não encontrado.");
    return template;
  }
}
