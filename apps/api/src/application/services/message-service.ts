import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  MessageFilters,
  MessageRepository,
  UpdateMessageInput,
} from "../../domain/repositories/message-repository.js";
import type {
  CreateMessageTemplateInput,
  MessageTemplateRepository,
  UpdateMessageTemplateInput,
} from "../../domain/repositories/message-template-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { ActivityLogger } from "./activity-logger.js";

export class MessageService {
  constructor(
    private readonly messages: MessageRepository,
    private readonly templates: MessageTemplateRepository,
    private readonly activityLogger: ActivityLogger,
  ) {}

  list(organizationId: string, filters: MessageFilters, pagination: PaginationParams) {
    return this.messages.list(organizationId, filters, pagination);
  }

  /**
   * Edição do corpo e transições de status. Não há envio automático (sem
   * provedor de WhatsApp/e-mail ainda) -- marcar como SENT registra que o
   * usuário enviou por fora, com carimbo de data e atividade na timeline.
   */
  async update(
    organizationId: string,
    userId: string,
    id: string,
    patch: { body?: string; status?: "DRAFT" | "SENT" | "FAILED" },
  ) {
    const existing = await this.messages.findByIdForOrg(id, organizationId);
    if (!existing) throw new NotFoundError("Mensagem não encontrada.");

    if (patch.body !== undefined && existing.status !== "DRAFT") {
      throw new ValidationError("Só rascunhos podem ter o texto editado.");
    }

    const resolved: UpdateMessageInput = { ...patch };
    if (patch.status === "SENT" && existing.status !== "SENT") {
      resolved.sentAt = new Date();
    }

    const message = await this.messages.update(id, organizationId, resolved);
    if (!message) throw new NotFoundError("Mensagem não encontrada.");

    if (patch.status === "SENT" && existing.status !== "SENT") {
      await this.activityLogger.log(organizationId, message.leadId, userId, "MESSAGE_SENT", {
        messageId: message.id,
        channel: message.channel,
      });
    }
    return message;
  }

  // ---- Templates ----

  listTemplates(organizationId: string) {
    return this.templates.listForOrg(organizationId);
  }

  createTemplate(
    organizationId: string,
    input: Omit<CreateMessageTemplateInput, "organizationId">,
  ) {
    return this.templates.create({ organizationId, ...input });
  }

  async updateTemplate(organizationId: string, id: string, patch: UpdateMessageTemplateInput) {
    const template = await this.templates.update(id, organizationId, patch);
    if (!template) throw new NotFoundError("Modelo de mensagem não encontrado.");
    return template;
  }
}
