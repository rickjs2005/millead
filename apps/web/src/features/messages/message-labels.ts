import type { MessageChannel, MessageStatus } from "@/types/api";

export const MESSAGE_CHANNEL_LABELS: Record<MessageChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  SMS: "SMS",
};

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  DRAFT: "Rascunho",
  QUEUED: "Na fila",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Lida",
  FAILED: "Falhou",
};

export const MESSAGE_STATUS_VARIANT: Record<
  MessageStatus,
  "default" | "success" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  QUEUED: "default",
  SENT: "success",
  DELIVERED: "success",
  READ: "success",
  FAILED: "destructive",
};
