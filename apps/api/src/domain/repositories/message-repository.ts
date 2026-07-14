import type { MessageChannel, MessageStatus } from "@millead/database";
import type { Message } from "../entities/message.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateMessageInput {
  organizationId: string;
  leadId: string;
  templateId?: string | null;
  channel: MessageChannel;
  body: string;
}

export interface UpdateMessageInput {
  body?: string;
  status?: MessageStatus;
  sentAt?: Date | null;
}

export interface MessageFilters {
  leadId?: string;
  status?: MessageStatus;
  channel?: MessageChannel;
}

export interface MessageRepository {
  create(input: CreateMessageInput): Promise<Message>;
  findByIdForOrg(id: string, organizationId: string): Promise<Message | null>;
  list(
    organizationId: string,
    filters: MessageFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Message>>;
  update(id: string, organizationId: string, patch: UpdateMessageInput): Promise<Message | null>;
}
