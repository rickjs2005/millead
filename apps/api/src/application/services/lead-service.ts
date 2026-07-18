import { ConflictError, NotFoundError } from "../../domain/errors/app-error.js";
import type {
  CreateLeadInput,
  LeadFilters,
  LeadRepository,
  UpdateLeadInput,
} from "../../domain/repositories/lead-repository.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { ActivityLogger } from "./activity-logger.js";

export class LeadService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly pipelines: PipelineRepository,
    private readonly activityLogger: ActivityLogger,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    input: Omit<CreateLeadInput, "organizationId">,
  ) {
    let pipelineStageId = input.pipelineStageId ?? null;
    if (pipelineStageId) {
      const stage = await this.pipelines.findStageForOrg(pipelineStageId, organizationId);
      if (!stage) throw new NotFoundError("Estágio de pipeline não encontrado.");
    } else {
      // Sem estágio explícito: cai no primeiro estágio do pipeline padrão --
      // é assim que "buscar empresa → salvar → aparece no board" funciona
      // sem o cliente precisar saber o id de um estágio.
      const defaultStage = await this.pipelines.findDefaultFirstStage(organizationId);
      pipelineStageId = defaultStage?.id ?? null;
    }

    const lead = await this.leads.create({ organizationId, ...input, pipelineStageId });
    await this.activityLogger.log(organizationId, lead.id, userId, "OTHER", {
      event: "lead_created",
    });
    return lead;
  }

  async get(organizationId: string, id: string) {
    const lead = await this.leads.findByIdForOrg(id, organizationId);
    if (!lead) throw new NotFoundError("Lead não encontrado.");
    return lead;
  }

  async list(organizationId: string, filters: LeadFilters, pagination: PaginationParams) {
    return this.leads.list(organizationId, filters, pagination);
  }

  async update(organizationId: string, id: string, patch: UpdateLeadInput) {
    const lead = await this.leads.update(id, organizationId, patch);
    if (!lead) throw new NotFoundError("Lead não encontrado.");
    return lead;
  }

  async delete(organizationId: string, id: string) {
    const result = await this.leads.delete(id, organizationId);
    if (result.status === "not_found") throw new NotFoundError("Lead não encontrado.");
    if (result.status === "blocked") {
      const parts: string[] = [];
      if (result.meetings > 0) parts.push(`${result.meetings} reunião(ões)`);
      if (result.proposals > 0) parts.push(`${result.proposals} proposta(s)`);
      if (result.messages > 0) parts.push(`${result.messages} mensagem(ns)`);
      throw new ConflictError(
        `Não é possível excluir: existem ${parts.join(", ")} vinculadas a este lead. Resolva ou arquive-as antes de excluir.`,
      );
    }
  }

  finance(organizationId: string) {
    return this.leads.finance(organizationId);
  }

  async moveStage(organizationId: string, userId: string, leadId: string, pipelineStageId: string) {
    const stage = await this.pipelines.findStageForOrg(pipelineStageId, organizationId);
    if (!stage) throw new NotFoundError("Estágio de pipeline não encontrado.");

    const status = stage.isWon ? "WON" : stage.isLost ? "LOST" : "OPEN";
    const closedAt = stage.isWon || stage.isLost ? new Date() : null;
    const lead = await this.leads.moveStage(leadId, organizationId, {
      pipelineStageId,
      status,
      closedAt,
    });
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    await this.activityLogger.log(organizationId, leadId, userId, "STATUS_CHANGE", {
      toStageId: stage.id,
      toStageName: stage.name,
      newStatus: status,
    });
    return lead;
  }

  async addContact(
    organizationId: string,
    leadId: string,
    input: { name: string; role?: string; email?: string; phone?: string; isPrimary?: boolean },
  ) {
    const contact = await this.leads.addContact(leadId, organizationId, input);
    if (!contact) throw new NotFoundError("Lead não encontrado.");
    return contact;
  }

  async removeContact(organizationId: string, leadId: string, contactId: string) {
    const removed = await this.leads.removeContact(contactId, leadId, organizationId);
    if (!removed) throw new NotFoundError("Contato não encontrado.");
  }

  async addNote(organizationId: string, userId: string, leadId: string, body: string) {
    const note = await this.leads.addNote(leadId, organizationId, userId, body);
    if (!note) throw new NotFoundError("Lead não encontrado.");
    await this.activityLogger.log(organizationId, leadId, userId, "NOTE", { noteId: note.id });
    return note;
  }

  async addTag(organizationId: string, leadId: string, tagId: string) {
    const ok = await this.leads.addTag(leadId, tagId, organizationId);
    if (!ok) throw new NotFoundError("Lead ou etiqueta não encontrados.");
  }

  async removeTag(organizationId: string, leadId: string, tagId: string) {
    const ok = await this.leads.removeTag(leadId, tagId, organizationId);
    if (!ok) throw new NotFoundError("Lead não encontrado.");
  }

  async listActivities(organizationId: string, leadId: string, pagination: PaginationParams) {
    const lead = await this.leads.findByIdForOrg(leadId, organizationId);
    if (!lead) throw new NotFoundError("Lead não encontrado.");
    return this.activityLogger.listForLead(organizationId, leadId, pagination);
  }
}
