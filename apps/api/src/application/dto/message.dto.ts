import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const listMessagesQuerySchema = paginationSchema.extend({
  leadId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED"]).optional(),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS"]).optional(),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const updateMessageSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  // Sem provedor de envio: o front só marca SENT (envio manual) ou volta pra DRAFT.
  status: z.enum(["DRAFT", "SENT", "FAILED"]).optional(),
});
export type UpdateMessageRequest = z.infer<typeof updateMessageSchema>;

export const createMessageTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS"]),
  subject: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
});
export type CreateMessageTemplateRequest = z.infer<typeof createMessageTemplateSchema>;

export const updateMessageTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS"]).optional(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).max(5000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMessageTemplateRequest = z.infer<typeof updateMessageTemplateSchema>;
