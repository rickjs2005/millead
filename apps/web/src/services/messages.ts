import { api } from "./api-client";
import type {
  Message,
  MessageChannel,
  MessageStatus,
  MessageTemplate,
  PaginatedResult,
} from "@/types/api";

export interface ListMessagesParams {
  page?: number;
  pageSize?: number;
  leadId?: string;
  status?: MessageStatus;
  channel?: MessageChannel;
}

export interface UpdateMessagePayload {
  body?: string;
  status?: "DRAFT" | "SENT" | "FAILED";
}

export interface CreateTemplatePayload {
  name: string;
  channel: MessageChannel;
  subject?: string;
  body: string;
}

export type UpdateTemplatePayload = Partial<CreateTemplatePayload> & { isActive?: boolean };

export const messagesService = {
  list: (params: ListMessagesParams = {}) =>
    api.get<PaginatedResult<Message>>("/api/v1/messages", params),

  update: (id: string, payload: UpdateMessagePayload) =>
    api.patch<Message>(`/api/v1/messages/${id}`, payload),

  listTemplates: () => api.get<MessageTemplate[]>("/api/v1/messages/templates"),

  createTemplate: (payload: CreateTemplatePayload) =>
    api.post<MessageTemplate>("/api/v1/messages/templates", payload),

  updateTemplate: (id: string, payload: UpdateTemplatePayload) =>
    api.patch<MessageTemplate>(`/api/v1/messages/templates/${id}`, payload),
};
