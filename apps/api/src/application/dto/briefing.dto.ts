import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

/** Admin: cria um briefing e gera o link público. */
export const createBriefingSchema = z.object({
  templateKey: z.string().min(1),
  leadId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
});
export type CreateBriefingRequest = z.infer<typeof createBriefingSchema>;

export const listBriefingsQuerySchema = paginationSchema.extend({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ARCHIVED"]).optional(),
  search: z.string().max(120).optional(),
  leadId: z.string().min(1).optional(),
});
export type ListBriefingsQuery = z.infer<typeof listBriefingsQuerySchema>;

/** Público: autosave de UM campo (topo ou item de GROUP). */
export const saveAnswerSchema = z.object({
  fieldId: z.string().min(1),
  groupItemId: z.string().max(80).optional(),
  groupItemOrder: z.coerce.number().int().min(0).optional(),
  valueText: z.string().max(10_000).nullable().optional(),
  valueJson: z.unknown().optional(),
});
export type SaveAnswerRequest = z.infer<typeof saveAnswerSchema>;

/** Público: remove um item de um campo GROUP (todos os campos-filho dele). */
export const removeGroupItemSchema = z.object({
  groupItemId: z.string().min(1).max(80),
});
export type RemoveGroupItemRequest = z.infer<typeof removeGroupItemSchema>;

/** Público: pedido de token de upload direto pro Vercel Blob. */
export const uploadTokenSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  sizeBytes: z.coerce.number().int().positive().max(200 * 1024 * 1024), // 200MB
});
export type UploadTokenRequest = z.infer<typeof uploadTokenSchema>;

/** Público: confirma um upload já concluído no Blob (registra BriefingFile). */
export const confirmFileSchema = z.object({
  blobUrl: z.string().url(),
  pathname: z.string().min(1),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.coerce.number().int().positive(),
});
export type ConfirmFileRequest = z.infer<typeof confirmFileSchema>;
