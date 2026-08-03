import { z } from "zod";

// Padrão money do estimate.dto.ts -- cada dto define o seu (não compartilhado).
const money = z.number().min(0).max(9_999_999);

// A composição (entrada + parcelas === total) é validada no SERVICE, com a
// diferença na mensagem -- o zod aqui só garante o shape (valores positivos,
// datas válidas, no máximo 60 parcelas).
export const createPlanSchema = z.object({
  contractId: z.string().min(1),
  total: money.positive(),
  entryAmount: money, // 0 = sem entrada
  entryDueDate: z.coerce.date(),
  installments: z.array(z.object({ amount: money.positive(), dueDate: z.coerce.date() })).max(60),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const paySchema = z.object({
  paidAt: z.coerce.date().optional(),
  paidNote: z.string().max(500).optional(),
});
export type PayInput = z.infer<typeof paySchema>;

export const updateReceivableSchema = z.object({
  amount: money.positive().optional(),
  dueDate: z.coerce.date().optional(),
});
export type UpdateReceivableInput = z.infer<typeof updateReceivableSchema>;

export const receivableQuerySchema = z.object({
  contractId: z.string().min(1).optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export type ReceivableQuery = z.infer<typeof receivableQuerySchema>;
