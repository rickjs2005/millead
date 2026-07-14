import type { MessageChannel } from "@millead/database";
import type { MessageTemplate } from "../entities/message.js";

export interface CreateMessageTemplateInput {
  organizationId: string;
  name: string;
  channel: MessageChannel;
  subject?: string | null;
  body: string;
}

export interface UpdateMessageTemplateInput {
  name?: string;
  channel?: MessageChannel;
  subject?: string | null;
  body?: string;
  isActive?: boolean;
}

export interface MessageTemplateRepository {
  create(input: CreateMessageTemplateInput): Promise<MessageTemplate>;
  findByIdForOrg(id: string, organizationId: string): Promise<MessageTemplate | null>;
  listForOrg(organizationId: string): Promise<MessageTemplate[]>;
  update(
    id: string,
    organizationId: string,
    patch: UpdateMessageTemplateInput,
  ): Promise<MessageTemplate | null>;
}
