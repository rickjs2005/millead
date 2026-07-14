import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine(
    (v) => /^\d+(\.\d{1,2})?$/.test(v),
    "Valor monetário inválido (use até 2 casas decimais).",
  );

export const createLeadSchema = z.object({
  title: z.string().min(1).max(200),
  companyId: z.string().min(1).optional(),
  pipelineStageId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  source: z.enum(["MANUAL", "IMPORT", "SCRAPER", "REFERRAL", "INBOUND"]).optional(),
  value: decimalString.optional(),
  currency: z.string().length(3).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  companyId: z.string().min(1).nullable().optional(),
  ownerId: z.string().min(1).nullable().optional(),
  value: decimalString.nullable().optional(),
  currency: z.string().length(3).optional(),
  lostReason: z.string().max(500).nullable().optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const listLeadsQuerySchema = paginationSchema.extend({
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
  pipelineStageId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  companyId: z.string().min(1).optional(),
  search: z.string().min(1).max(200).optional(),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;

export const moveLeadStageSchema = z.object({
  pipelineStageId: z.string().min(1),
});
export type MoveLeadStageInput = z.infer<typeof moveLeadStageSchema>;

export const addLeadContactSchema = z.object({
  name: z.string().min(1).max(150),
  role: z.string().max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  isPrimary: z.boolean().optional(),
});
export type AddLeadContactInput = z.infer<typeof addLeadContactSchema>;

export const addLeadNoteSchema = z.object({
  body: z.string().min(1).max(4000),
});
export type AddLeadNoteInput = z.infer<typeof addLeadNoteSchema>;

export const addLeadTagSchema = z.object({
  tagId: z.string().min(1),
});
export type AddLeadTagInput = z.infer<typeof addLeadTagSchema>;

export const listActivitiesQuerySchema = paginationSchema;
