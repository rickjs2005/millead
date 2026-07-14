import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine(
    (v) => /^\d+(\.\d{1,2})?$/.test(v),
    "Valor monetário inválido (use até 2 casas decimais).",
  );

export const createProposalSchema = z.object({
  leadId: z.string().min(1),
  title: z.string().min(1).max(200),
  value: decimalString,
  currency: z.string().length(3).optional(),
  validUntil: z.coerce.date().optional(),
  pdfUrl: z.string().url().max(500).optional(),
});
export type CreateProposalInput = z.infer<typeof createProposalSchema>;

export const updateProposalSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  value: decimalString.optional(),
  currency: z.string().length(3).optional(),
  validUntil: z.coerce.date().nullable().optional(),
  pdfUrl: z.string().url().max(500).nullable().optional(),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
});
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;

export const listProposalsQuerySchema = paginationSchema.extend({
  leadId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
});
export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
