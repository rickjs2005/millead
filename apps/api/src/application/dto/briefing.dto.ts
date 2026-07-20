import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

/** Admin: cria um briefing e gera o link público. */
export const createBriefingSchema = z.object({
  templateKey: z.string().min(1),
  leadId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
});
export type CreateBriefingRequest = z.infer<typeof createBriefingSchema>;

/** Tipos de campo que o usuário pode montar num briefing personalizado
 * (GROUP fica de fora de propósito -- complexidade de UI sem demanda). */
const customFieldTypeSchema = z.enum([
  "TEXT",
  "TEXTAREA",
  "EMAIL",
  "PHONE",
  "URL",
  "SELECT",
  "MULTI_SELECT",
  "FILE",
]);

const customFieldSchema = z
  .object({
    label: z.string().min(1).max(120),
    type: customFieldTypeSchema,
    required: z.boolean().optional().default(false),
    helpText: z.string().max(300).optional(),
    /** SELECT/MULTI_SELECT: opções que o cliente escolhe. */
    options: z.array(z.string().min(1).max(80)).max(30).optional(),
    /** FILE: limite de arquivos (fotos/vídeos). */
    maxFiles: z.coerce.number().int().min(1).max(30).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "SELECT" || field.type === "MULTI_SELECT") {
      const options = field.options ?? [];
      if (options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Campo de escolha precisa de pelo menos 2 opções.",
        });
      }
      // opções repetidas quebram o render público (React key duplicada +
      // toggle compartilhado no MULTI_SELECT) -- rejeita antes de gravar.
      const seen = new Set(options.map((o) => o.trim().toLowerCase()));
      if (seen.size !== options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "As opções não podem se repetir.",
        });
      }
    }
  });
export type CustomFieldInput = z.infer<typeof customFieldSchema>;

/** Admin: cria um briefing PERSONALIZADO (template sob medida + link). */
export const createCustomBriefingSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(300).optional(),
  leadId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  /** Prefixa a seção "Seus dados" (nome/WhatsApp/e-mail) -- alimenta a
   * denormalização de contato da lista admin. */
  includeContact: z.boolean().optional().default(true),
  fields: z.array(customFieldSchema).min(1).max(30),
});
export type CreateCustomBriefingRequest = z.infer<typeof createCustomBriefingSchema>;

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
  sizeBytes: z.coerce
    .number()
    .int()
    .positive()
    .max(200 * 1024 * 1024), // 200MB
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
