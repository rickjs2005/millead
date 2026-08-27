import { z } from "zod";
import { moneyInput, positiveMoneyInput } from "./money-input.js";
import { parseUtcDate } from "../services/vault-date.js";

/**
 * Validação de entrada do núcleo do Cofre.
 *
 * Duas escolhas que valem explicação:
 *
 * - **Dinheiro chega como string**, não como number. `z.coerce.number()` aceita
 *   `120.005` e depois o float estraga a soma; a string preserva exatamente o
 *   que veio e o parsing pra centavos (`vault-money.ts`) recusa o que não for
 *   dinheiro de verdade.
 * - **Data chega como `AAAA-MM-DD`** e vira `Date` em UTC. `z.coerce.date()`
 *   interpretaria no fuso do servidor, e a data andaria um dia dependendo de
 *   onde a API estivesse rodando — o bug clássico do fuso do Brasil.
 */

const money = moneyInput;

const positiveMoney = positiveMoneyInput();

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

/** Só os quatro últimos dígitos — o número completo nunca entra no sistema. */
const last4 = z.string().regex(/^\d{4}$/, "Informe exatamente os 4 últimos dígitos.");

const currency = z.enum(["BRL", "USD", "EUR"]);
const dayOfMonth = z.coerce.number().int().min(1).max(31);

// ===== Contas =====

export const createAccountSchema = z.object({
  name: z.string().min(1).max(120),
  institution: z.string().max(120).nullable().default(null),
  type: z.enum(["CHECKING", "SAVINGS", "DIGITAL_WALLET", "CASH"]),
  currency: currency.default("BRL"),
  last4: last4.nullable().default(null),
  reportedBalance: money.nullable().default(null),
  reportedBalanceAt: calendarDate.nullable().default(null),
});
export type CreateAccountBody = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateAccountBody = z.infer<typeof updateAccountSchema>;

// ===== Cartões =====

export const createCardSchema = z.object({
  name: z.string().min(1).max(120),
  institution: z.string().max(120).nullable().default(null),
  last4: last4.nullable().default(null),
  limitAmount: money.nullable().default(null),
  closingDay: dayOfMonth,
  dueDay: dayOfMonth,
  paymentAccountId: z.string().min(1).nullable().default(null),
});
export type CreateCardBody = z.infer<typeof createCardSchema>;

export const updateCardSchema = createCardSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCardBody = z.infer<typeof updateCardSchema>;

// ===== Categorias =====

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().min(1).nullable().default(null),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida — use #RRGGBB.")
    .nullable()
    .default(null),
});
export type CreateCategoryBody = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpdateCategoryBody = z.infer<typeof updateCategorySchema>;

// ===== Fornecedores =====

export const createMerchantSchema = z.object({
  name: z.string().min(1).max(120),
  defaultCategoryId: z.string().min(1).nullable().default(null),
  aliases: z.array(z.string().min(1).max(160)).max(50).default([]),
});
export type CreateMerchantBody = z.infer<typeof createMerchantSchema>;

export const updateMerchantSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  defaultCategoryId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMerchantBody = z.infer<typeof updateMerchantSchema>;

export const addAliasSchema = z.object({ alias: z.string().min(1).max(160) });
export type AddAliasBody = z.infer<typeof addAliasSchema>;

// ===== Movimentações =====

export const transactionQuerySchema = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  /** Competência (quando a compra aconteceu) ou caixa (quando o dinheiro se
   *  moveu). Nunca misturados sem rótulo — a tela mostra qual está ativo. */
  basis: z.enum(["ACCRUAL", "CASH"]).default("ACCRUAL"),
  accountId: z.string().min(1).optional(),
  cardId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  merchantId: z.string().min(1).optional(),
  statementId: z.string().min(1).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "IGNORED", "REVERSED"]).optional(),
  direction: z.enum(["IN", "OUT"]).optional(),
  includeTransfers: z.coerce.boolean().default(false),
  search: z.string().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;

export const createTransactionSchema = z
  .object({
    accountId: z.string().min(1).nullable().default(null),
    cardId: z.string().min(1).nullable().default(null),
    transactionDate: calendarDate,
    settlementDate: calendarDate.nullable().default(null),
    description: z.string().min(1).max(300),
    merchantId: z.string().min(1).nullable().default(null),
    categoryId: z.string().min(1).nullable().default(null),
    direction: z.enum(["IN", "OUT"]),
    amount: positiveMoney,
    currency: currency.default("BRL"),
    originalAmount: money.nullable().default(null),
    originalCurrency: currency.nullable().default(null),
    amountBrl: money.nullable().default(null),
    note: z.string().max(500).nullable().default(null),
    installmentNumber: z.coerce.number().int().min(1).max(99).nullable().default(null),
    installmentTotal: z.coerce.number().int().min(1).max(99).nullable().default(null),
    isTransfer: z.boolean().default(false),
  })
  // O CHECK do banco também recusa, mas falhar aqui devolve 422 com mensagem
  // legível em vez de um 500 de constraint violada.
  .refine((v) => (v.accountId === null) !== (v.cardId === null), {
    message: "Informe exatamente uma origem: conta ou cartão.",
    path: ["accountId"],
  })
  .refine((v) => v.currency === "BRL" || v.amountBrl !== null, {
    message: "Informe o valor cobrado em BRL para movimentações em moeda estrangeira.",
    path: ["amountBrl"],
  })
  .refine(
    (v) =>
      (v.installmentNumber === null) === (v.installmentTotal === null) &&
      (v.installmentNumber === null || v.installmentNumber <= v.installmentTotal!),
    { message: "Parcela incoerente.", path: ["installmentNumber"] },
  );
export type CreateTransactionBody = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object({
  transactionDate: calendarDate.optional(),
  settlementDate: calendarDate.nullable().optional(),
  merchantId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "IGNORED", "REVERSED"]).optional(),
  isTransfer: z.boolean().optional(),
});
export type UpdateTransactionBody = z.infer<typeof updateTransactionSchema>;

/** Substitui o rateio inteiro — não existe "adicionar uma divisão". */
export const replaceSplitsSchema = z.object({
  splits: z
    .array(
      z.object({
        kind: z.enum(["PERSONAL", "REIMBURSABLE", "BUSINESS"]),
        amount: positiveMoney,
        categoryId: z.string().min(1).nullable().default(null),
        note: z.string().max(300).nullable().default(null),
      }),
    )
    .max(20),
});
export type ReplaceSplitsBody = z.infer<typeof replaceSplitsSchema>;

export const createTransferSchema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    date: calendarDate,
    amount: positiveMoney,
    description: z.string().min(1).max(300).default("Transferência entre contas"),
    note: z.string().max(500).nullable().default(null),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "Origem e destino são a mesma conta.",
    path: ["toAccountId"],
  });
export type CreateTransferBody = z.infer<typeof createTransferSchema>;

// ===== Faturas =====

export const statementQuerySchema = z.object({ cardId: z.string().min(1).optional() });
export type StatementQuery = z.infer<typeof statementQuerySchema>;

export const payStatementSchema = z.object({
  amount: positiveMoney,
  date: calendarDate,
  /** Conta de onde o dinheiro saiu. Null registra só a baixa na fatura, sem
   *  criar a movimentação de caixa — útil quando o extrato da conta ainda vai
   *  ser importado e criaria a linha de novo. */
  accountId: z.string().min(1).nullable().default(null),
});
export type PayStatementBody = z.infer<typeof payStatementSchema>;

export const listQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Mês do resumo. `AAAA-MM` e nada mais: um intervalo livre num painel mensal
 *  produziria um "resumo do mês" que não é de mês nenhum. */
export const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido — use AAAA-MM."),
});
export type MonthQuery = z.infer<typeof monthQuerySchema>;
