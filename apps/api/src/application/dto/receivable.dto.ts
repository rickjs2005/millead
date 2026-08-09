import { z } from "zod";

// Padrão money do estimate.dto.ts -- cada dto define o seu (não compartilhado).
const money = z.number().min(0).max(9_999_999);

const MIN_PLAUSIBLE_DATE = new Date("2020-01-01T00:00:00Z");
const FIFTEEN_YEARS_MS = 15 * 365 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Vencimentos (entrada/parcela): sanidade contra digitação (ano trocado,
 *  data absurda), não regra de negócio -- intervalo bem largo. */
const dueDate = z.coerce
  .date()
  .refine((d) => d.getTime() >= MIN_PLAUSIBLE_DATE.getTime(), {
    message: "Data de vencimento implausível (antes de 2020).",
  })
  .refine((d) => d.getTime() <= Date.now() + FIFTEEN_YEARS_MS, {
    message: "Data de vencimento implausível (mais de 15 anos no futuro).",
  });

/** `paidAt` representa um pagamento que JÁ aconteceu -- sem limite não dava
 *  pra pegar um typo de data futura, que some silenciamente do relatório de
 *  caixa até aquele mês "chegar" (regime de caixa é por mês de `paidAt`).
 *  Folga de 1 dia só pra fuso/clock skew entre cliente e servidor. */
const paidAtDate = z.coerce
  .date()
  .refine((d) => d.getTime() <= Date.now() + ONE_DAY_MS, {
    message: "Data de pagamento não pode ser no futuro.",
  })
  .refine((d) => d.getTime() >= MIN_PLAUSIBLE_DATE.getTime(), {
    message: "Data de pagamento implausível (antes de 2020).",
  });

// A composição (entrada + parcelas === total) é validada no SERVICE, com a
// diferença na mensagem -- o zod aqui só garante o shape (valores positivos,
// datas válidas, no máximo 60 parcelas).
export const createPlanSchema = z.object({
  contractId: z.string().min(1),
  total: money.positive(),
  entryAmount: money, // 0 = sem entrada
  entryDueDate: dueDate,
  installments: z.array(z.object({ amount: money.positive(), dueDate })).max(60),
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const paySchema = z.object({
  paidAt: paidAtDate.optional(),
  paidNote: z.string().max(500).optional(),
});
export type PayInput = z.infer<typeof paySchema>;

export const updateReceivableSchema = z.object({
  amount: money.positive().optional(),
  dueDate: dueDate.optional(),
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

export const receivableSeriesQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(12),
});
export type ReceivableSeriesQuery = z.infer<typeof receivableSeriesQuerySchema>;
