import type { MessageChannel, MessageDirection, MessageStatus } from "@millead/database";

export interface Message {
  id: string;
  organizationId: string;
  leadId: string;
  templateId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  body: string;
  sentAt: Date | null;
  createdAt: Date;
}

export interface MessageTemplate {
  id: string;
  organizationId: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  variables: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
