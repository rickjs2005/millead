import { randomBytes, randomInt } from "node:crypto";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  BriefingFilters,
  BriefingRepository,
} from "../../domain/repositories/briefing-repository.js";
import type {
  BriefingTemplateRepository,
  CreateCustomTemplateInput,
} from "../../domain/repositories/briefing-template-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import { extractCompanyData } from "./briefing-company-extractor.js";
import type { BriefingNotifier } from "../../domain/services/briefing-notifier.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { CreateCustomBriefingRequest } from "../dto/briefing.dto.js";
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

/** "Quais marcas você trabalha?" → "quais_marcas_voce_trabalha". */
function slugify(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return slug || "campo";
}

function uniqueKey(base: string, used: Set<string>): string {
  let key = base;
  let suffix = 2;
  while (used.has(key)) key = `${base}_${suffix++}`;
  used.add(key);
  return key;
}

/** Config por tipo, no mesmo formato dos templates do seed. */
function buildFieldConfig(field: { type: string; options?: string[]; maxFiles?: number }): unknown {
  if (field.type === "SELECT" || field.type === "MULTI_SELECT") {
    return { options: field.options ?? [] };
  }
  if (field.type === "FILE") {
    return {
      accept: [".png", ".jpg", ".jpeg", ".webp", ".svg", ".mp4", ".mov", ".webm", ".pdf"],
      maxFiles: field.maxFiles ?? 10,
    };
  }
  return undefined;
}

export class BriefingService {
  constructor(
    private readonly briefings: BriefingRepository,
    private readonly templates: BriefingTemplateRepository,
    private readonly notifier: BriefingNotifier,
    private readonly activityLogger: ActivityLogger,
    private readonly companies: CompanyRepository,
    private readonly leads: LeadRepository,
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
    const template = await this.templates.findByKey(input.templateKey, organizationId);
    if (!template) throw new ValidationError(`Template "${input.templateKey}" não encontrado.`);
    // Template CUSTOM pertence a UMA organização e a UM briefing -- não pode
    // ser instanciado de novo via chave (nem por outra org).
    if (template.kind === "CUSTOM") {
      throw new ValidationError("Template personalizado não pode ser reutilizado por chave.");
    }

    return this.instantiate(organizationId, createdById, template, input);
  }

  /**
   * Briefing PERSONALIZADO: o usuário monta os campos na hora (ex.: só
   * "quais marcas trabalha" pra um cliente específico). Vira um template
   * kind CUSTOM escopado na organização + um briefing normal apontando pra
   * ele -- o wizard público, o autosave, o PDF e a lista admin funcionam
   * sem mudar nada, porque só enxergam "um template com seções e campos".
   */
  async createCustom(
    organizationId: string,
    createdById: string | null,
    input: CreateCustomBriefingRequest,
  ) {
    const sections: CreateCustomTemplateInput["sections"] = [];

    // Seção de contato compacta: as keys "empresa"/nome/whatsapp/email são
    // as que o BriefingAnswerService usa pra denormalizar Briefing.contact*.
    if (input.includeContact) {
      sections.push({
        key: "empresa",
        title: "Seus dados",
        description: "Pra sabermos quem está respondendo.",
        order: 0,
        fields: [
          { key: "nome", label: "Seu nome", type: "TEXT", order: 0, required: true },
          { key: "whatsapp", label: "WhatsApp", type: "PHONE", order: 1, required: false },
          { key: "email", label: "E-mail", type: "EMAIL", order: 2, required: false },
        ],
      });
    }

    const usedKeys = new Set<string>();
    sections.push({
      key: "personalizado",
      title: input.title,
      description: input.description ?? null,
      order: sections.length,
      fields: input.fields.map((field, index) => ({
        key: uniqueKey(slugify(field.label), usedKeys),
        label: field.label,
        type: field.type,
        order: index,
        required: field.required ?? false,
        helpText: field.helpText ?? null,
        config: buildFieldConfig(field),
      })),
    });

    const template = await this.templates.createCustom({
      organizationId,
      key: `custom-${randomBytes(6).toString("hex")}`,
      name: input.title,
      description: input.description ?? null,
      sections,
    });

    return this.instantiate(organizationId, createdById, template, input);
  }

  private async instantiate(
    organizationId: string,
    createdById: string | null,
    template: { id: string; kind: string },
    input: { leadId?: string | null; companyId?: string | null },
  ) {
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

  /**
   * Cria OU atualiza a Empresa a partir das respostas do briefing concluído
   * — e costura o grafo: briefing.companyId e lead.companyId (se o lead
   * ainda não tinha empresa) passam a apontar pra ela. Update é fill-empty:
   * nunca sobrescreve o que já foi preenchido à mão no cadastro.
   */
  async applyToCompany(organizationId: string, userId: string | null, id: string) {
    const briefing = await this.briefings.findByIdForOrg(id, organizationId);
    if (!briefing) throw new NotFoundError("Briefing não encontrado.");
    if (briefing.status !== "COMPLETED") {
      throw new ValidationError("Só briefings concluídos podem virar cadastro de empresa.");
    }

    const data = extractCompanyData(briefing);

    // Alvo: empresa já vinculada ao briefing, senão a do lead, senão cria.
    let companyId = briefing.companyId;
    const lead = briefing.leadId
      ? await this.leads.findByIdForOrg(briefing.leadId, organizationId)
      : null;
    if (!companyId && lead?.companyId) companyId = lead.companyId;

    let created = false;
    if (companyId) {
      const existing = await this.companies.findByIdForOrg(companyId, organizationId);
      if (!existing) throw new NotFoundError("Empresa vinculada não encontrada.");
      // fill-empty: só preenche o que está vazio no cadastro
      const patch: Record<string, string> = {};
      if (!existing.document && data.document) patch.document = data.document;
      if (!existing.city && data.city) patch.city = data.city;
      if (!existing.state && data.state) patch.state = data.state;
      if (!existing.phone && data.phone) patch.phone = data.phone;
      if (!existing.email && data.email) patch.email = data.email;
      if (!existing.notes && data.notes) patch.notes = data.notes;
      if (Object.keys(patch).length) {
        await this.companies.update(companyId, organizationId, patch);
      }
    } else {
      const name = data.name ?? briefing.contactName ?? "Empresa do briefing";
      // CNPJ é unique por org — se já existe empresa com esse documento, usa ela.
      const byDocument = data.document
        ? await this.companies.findByDocumentForOrg(data.document, organizationId)
        : null;
      if (byDocument) {
        companyId = byDocument.id;
      } else {
        const company = await this.companies.create({
          organizationId,
          name,
          document: data.document,
          city: data.city,
          state: data.state,
          phone: data.phone,
          email: data.email,
          notes: data.notes,
        });
        companyId = company.id;
        created = true;
      }
    }

    // sites e redes: addWebsite/addSocial são únicos por URL — duplicata é no-op tolerado
    for (const url of data.websites) {
      await this.companies.addWebsite(companyId, organizationId, { url }).catch(() => null);
    }
    for (const social of data.socials) {
      await this.companies.addSocial(companyId, organizationId, social).catch(() => null);
    }

    // costura o grafo: briefing → empresa; lead sem empresa → empresa
    if (briefing.companyId !== companyId) {
      await this.briefings.linkCompany(briefing.id, companyId);
    }
    if (lead && !lead.companyId) {
      await this.leads.update(lead.id, organizationId, { companyId });
    }
    if (briefing.leadId) {
      await this.activityLogger.log(organizationId, briefing.leadId, userId, "OTHER", {
        action: created ? "company_created_from_briefing" : "company_updated_from_briefing",
        briefingId: briefing.id,
        companyId,
      });
    }

    const company = await this.companies.findByIdForOrg(companyId, organizationId);
    return { company, created };
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
    await this.briefings.addHistory(
      id,
      organizationId,
      `REENVIADO_${channel.toUpperCase()}`,
      "APP",
    );
    return briefing;
  }

  listTemplates() {
    return this.templates.list();
  }

  async getTemplate(organizationId: string, key: string) {
    const template = await this.templates.findByKey(key, organizationId);
    if (!template) throw new NotFoundError("Template não encontrado.");
    return template;
  }
}
