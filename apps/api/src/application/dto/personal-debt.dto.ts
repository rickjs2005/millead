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
  .refine((v) => Number(v) > 0, "O valor precisa ser maior que zero.");

// ----- Pessoas -----

export const createContactSchema = z.object({
  name: z.string().min(1).max(120),
  /** Texto livre. Não existe campo de CPF, conta ou chave Pix — o Cofre não
   *  guarda credencial de ninguém, nem de terceiro. */
  contact: z.string().max(200).nullable().default(null),
  notes: z.string().max(500).nullable().default(null),
});

export const updateContactSchema = createContactSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Envie ao menos um campo.");

export const contactQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(false),
});

// ----- Dívidas -----

export const createDebtSchema = z
  .object({
    contactId: z.string().min(1),
    direction: z.enum(["THEY_OWE_ME", "I_OWE_THEM"]),
    description: z.string().min(1).max(200),
    amount: money,
    currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
    dueDate: calendarDate.nullable().default(null),
    originTransactionId: z.string().min(1).nullable().default(null),
    notes: z.string().max(500).nullable().default(null),
    markOriginReimbursable: z.boolean().default(false),
  })
  // O serviço também recusa, com mensagem melhor; falhar aqui evita a viagem
  // ao banco quando o pedido já é incoerente por construção.
  .refine((v) => !v.markOriginReimbursable || v.originTransactionId !== null, {
    message: "Marcar a compra como reembolsável exige informar a movimentação de origem.",
    path: ["originTransactionId"],
  });

export const updateDebtSchema = z
  .object({
    description: z.string().min(1).max(200).optional(),
    amount: money.optional(),
    dueDate: calendarDate.nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
    /** Cancelar e descancelar. É o único campo de estado que existe: o resto
     *  (aberta, parcial, quitada, atrasada) é derivado — ver `debt-status.ts`. */
    canceled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Envie ao menos um campo.");

export const debtQuerySchema = z.object({
  direction: z.enum(["THEY_OWE_ME", "I_OWE_THEM"]).nullable().default(null),
  contactId: z.string().min(1).nullable().default(null),
  includeCanceled: z.coerce.boolean().default(false),
  /** Quitadas ficam fora por padrão: a tela padrão é "o que ainda está em
   *  aberto", e misturar as duas transforma a lista num extrato. */
  includeSettled: z.coerce.boolean().default(false),
});

// ----- Baixas -----

export const addPaymentSchema = z.object({
  amount: money,
  paidAt: calendarDate,
  /** A movimentação que representa a baixa — o Pix que caiu. Opcional: dá pra
   *  registrar "me devolveu em dinheiro" sem movimentação nenhuma. */
  transactionId: z.string().min(1).nullable().default(null),
  note: z.string().max(300).nullable().default(null),
});

export type CreateContactBody = z.infer<typeof createContactSchema>;
export type UpdateContactBody = z.infer<typeof updateContactSchema>;
export type ContactQuery = z.infer<typeof contactQuerySchema>;
export type CreateDebtBody = z.infer<typeof createDebtSchema>;
export type UpdateDebtBody = z.infer<typeof updateDebtSchema>;
export type DebtQuery = z.infer<typeof debtQuerySchema>;
export type AddPaymentBody = z.infer<typeof addPaymentSchema>;
