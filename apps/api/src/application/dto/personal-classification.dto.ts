import { z } from "zod";

/**
 * Regras de classificação e correção manual.
 *
 * A faixa de valor entra como string decimal (padrão do módulo) e é convertida
 * pra centavos no service — o comparador trabalha em centavos, e converter na
 * fronteira evita que cada chamador lembre de fazer isso.
 */

const money = z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido.");
const percent = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Percentual inválido.")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "O percentual precisa estar entre 0 e 100.");

const ruleShape = {
  name: z.string().min(1).max(80).nullable().default(null),
  /** Menor roda primeiro. */
  priority: z.coerce.number().int().min(0).max(9999).default(100),
  matchType: z.enum(["CONTAINS", "STARTS_WITH", "EXACT"]).nullable().default(null),
  matchValue: z.string().min(1).max(200).nullable().default(null),
  matchMerchantId: z.string().min(1).nullable().default(null),
  matchAccountId: z.string().min(1).nullable().default(null),
  matchCardId: z.string().min(1).nullable().default(null),
  matchAmountMin: money.nullable().default(null),
  matchAmountMax: money.nullable().default(null),
  setMerchantId: z.string().min(1).nullable().default(null),
  setCategoryId: z.string().min(1).nullable().default(null),
  businessPercent: percent.nullable().default(null),
};

export const createRuleSchema = z
  .object(ruleShape)
  // `matchType` e `matchValue` andam juntos: um sem o outro é condição pela
  // metade, e o CHECK do banco recusaria com um 409 ilegível.
  .refine((v) => (v.matchType === null) === (v.matchValue === null), {
    message: "Informe o tipo de comparação junto com o texto.",
    path: ["matchValue"],
  })
  .refine(
    (v) =>
      v.matchAmountMin === null ||
      v.matchAmountMax === null ||
      Number(v.matchAmountMin) <= Number(v.matchAmountMax),
    { message: "O valor mínimo não pode ser maior que o máximo.", path: ["matchAmountMax"] },
  );
export type CreateRuleBody = z.infer<typeof createRuleSchema>;

export const updateRuleSchema = z.object({
  name: z.string().min(1).max(80).nullable().optional(),
  priority: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  matchType: z.enum(["CONTAINS", "STARTS_WITH", "EXACT"]).nullable().optional(),
  matchValue: z.string().min(1).max(200).nullable().optional(),
  matchMerchantId: z.string().min(1).nullable().optional(),
  matchAccountId: z.string().min(1).nullable().optional(),
  matchCardId: z.string().min(1).nullable().optional(),
  matchAmountMin: money.nullable().optional(),
  matchAmountMax: money.nullable().optional(),
  setMerchantId: z.string().min(1).nullable().optional(),
  setCategoryId: z.string().min(1).nullable().optional(),
  businessPercent: percent.nullable().optional(),
});
export type UpdateRuleBody = z.infer<typeof updateRuleSchema>;

/**
 * Correção manual. `createRule` é a segunda opção do fluxo combinado:
 * "corrigir somente esta" (sem `createRule`) ou "criar regra para as
 * próximas" (com).
 */
export const correctClassificationSchema = z.object({
  merchantId: z.string().min(1).nullable().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  businessPercent: percent.nullable().optional(),
  createRule: z
    .object({
      name: z.string().min(1).max(80).nullable().default(null),
      matchType: z.enum(["CONTAINS", "STARTS_WITH", "EXACT"]).default("CONTAINS"),
      matchValue: z.string().min(1).max(200),
      priority: z.coerce.number().int().min(0).max(9999).default(100),
      /** Limita a regra à conta/cartão desta movimentação. */
      scopeToOrigin: z.boolean().default(false),
    })
    .nullable()
    .default(null),
});
export type CorrectClassificationBody = z.infer<typeof correctClassificationSchema>;

export const classificationRunSchema = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(500),
});
export type ClassificationRunBody = z.infer<typeof classificationRunSchema>;
