import { z } from "zod";
import { parseUtcDate } from "../services/vault-date.js";

/** Data de calendário em UTC — ver `vault-date.ts` sobre o deslize de fuso. */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use AAAA-MM-DD.")
  .transform((value, ctx) => {
    const parsed = parseUtcDate(value);
    if (!parsed) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Data inexistente no calendário." });
      return z.NEVER;
    }
    return parsed;
  });

const money = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Valor inválido.")
  .refine((v) => Number(v) > 0, "O valor esperado precisa ser maior que zero.");

const base = {
  name: z.string().min(1).max(120),
  merchantId: z.string().min(1).nullable().default(null),
  categoryId: z.string().min(1).nullable().default(null),
  accountId: z.string().min(1).nullable().default(null),
  cardId: z.string().min(1).nullable().default(null),
  expectedAmount: money,
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  period: z.enum(["MONTHLY", "YEARLY", "CUSTOM"]).default("MONTHLY"),
  customIntervalDays: z.coerce.number().int().min(1).max(3650).nullable().default(null),
  lastChargeAt: calendarDate.nullable().default(null),
  nextRenewalAt: calendarDate.nullable().default(null),
  alertDaysBefore: z.coerce.number().int().min(0).max(365).default(7),
  /** Assinatura em dólar oscila com o câmbio todo mês; tolerância zero geraria
   *  alerta em toda cobrança e você pararia de ler os alertas. */
  priceTolerancePct: z.coerce.number().min(0).max(100).default(10),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELED"]).default("ACTIVE"),
  autoRenew: z.boolean().default(true),
  costSubscriptionId: z.string().min(1).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
};

export const createSubscriptionSchema = z
  .object(base)
  // O CHECK do banco também recusa; falhar aqui devolve 422 legível em vez de
  // um 409 de constraint.
  .refine((v) => (v.period === "CUSTOM") === (v.customIntervalDays !== null), {
    message: "Periodicidade personalizada exige o intervalo em dias — e só ela o aceita.",
    path: ["customIntervalDays"],
  });
export type CreateSubscriptionBody = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  merchantId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  accountId: z.string().min(1).nullable().optional(),
  cardId: z.string().min(1).nullable().optional(),
  expectedAmount: money.optional(),
  currency: z.enum(["BRL", "USD", "EUR"]).optional(),
  period: z.enum(["MONTHLY", "YEARLY", "CUSTOM"]).optional(),
  customIntervalDays: z.coerce.number().int().min(1).max(3650).nullable().optional(),
  lastChargeAt: calendarDate.nullable().optional(),
  nextRenewalAt: calendarDate.nullable().optional(),
  alertDaysBefore: z.coerce.number().int().min(0).max(365).optional(),
  priceTolerancePct: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELED"]).optional(),
  autoRenew: z.boolean().optional(),
  costSubscriptionId: z.string().min(1).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type UpdateSubscriptionBody = z.infer<typeof updateSubscriptionSchema>;

export const subscriptionQuerySchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "CANCELED"]).optional(),
});
export type SubscriptionQuery = z.infer<typeof subscriptionQuerySchema>;

export const snoozeAlertSchema = z.object({
  /** Até quando esconder. Adiar sem prazo seria esconder pra sempre. */
  until: calendarDate,
});
export type SnoozeAlertBody = z.infer<typeof snoozeAlertSchema>;
