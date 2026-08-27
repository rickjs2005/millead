import { z } from "zod";
import { parseUtcDate } from "../services/vault-date.js";

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
  .refine((v) => Number(v) > 0, "O valor precisa ser maior que zero.");

const category = z.enum(["HOSTING", "DATABASE", "AI", "DOMAIN", "EMAIL", "SIGNATURE", "OTHER"]);

// ----- Lado empresarial -----

export const createExpenseSchema = z.object({
  description: z.string().min(1).max(200),
  amount: money,
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  incurredAt: calendarDate,
  category: category.default("OTHER"),
  costSubscriptionId: z.string().min(1).nullable().default(null),
  companyId: z.string().min(1).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

export const updateExpenseSchema = createExpenseSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Envie ao menos um campo.");

export const expenseQuerySchema = z.object({
  from: calendarDate.nullable().default(null),
  to: calendarDate.nullable().default(null),
  costSubscriptionId: z.string().min(1).nullable().default(null),
  source: z.enum(["MANUAL", "PERSONAL_VAULT"]).nullable().default(null),
});

/** O resumo é sempre de um período fechado: comparar um plano MENSAL com um
 *  realizado de intervalo indefinido não significaria nada. */
export const expenseSummaryQuerySchema = z.object({
  from: calendarDate,
  to: calendarDate,
});

// ----- Ponte (lado do Cofre) -----

export const pushExpenseSchema = z.object({
  /** Obrigatória de propósito: a alternativa seria copiar a linha crua do
   *  extrato pro financeiro da empresa sem ninguém ter decidido isso. */
  description: z.string().min(1).max(200),
  category: category.default("OTHER"),
  costSubscriptionId: z.string().min(1).nullable().default(null),
  companyId: z.string().min(1).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

export const bridgeQuerySchema = z.object({
  from: calendarDate.nullable().default(null),
  to: calendarDate.nullable().default(null),
});

export type CreateExpenseBody = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseBody = z.infer<typeof updateExpenseSchema>;
export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;
export type ExpenseSummaryQuery = z.infer<typeof expenseSummaryQuerySchema>;
export type PushExpenseBody = z.infer<typeof pushExpenseSchema>;
export type BridgeQuery = z.infer<typeof bridgeQuerySchema>;
