import { z } from "zod";

/** `null` explícito = "limpar este campo"; ausente = "não mexer". Por isso
 *  cada campo opcional é `.nullable().optional()` em vez de só `.optional()`
 *  -- sem isso não haveria como desconfigurar um estágio/template já salvo. */
const nullableId = z.string().min(1).max(64).nullable().optional();

/**
 * Limites de sanidade, não regra de negócio: 60 parcelas é o mesmo teto do
 * `createPlanSchema`; 2 anos de prazo cobre qualquer condição plausível e
 * ainda pega typo de data (ex.: 3000 dias).
 */
const MAX_INSTALLMENTS = 60;
const MAX_DUE_DAYS = 730;

export const updatePostSaleSettingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    wonStageId: nullableId,
    briefingTemplateKey: z.string().min(1).max(100).nullable().optional(),
    projectType: z.enum(["INSTITUTIONAL", "SYSTEM"]).nullable().optional(),
    defaultOwnerId: nullableId,
    createReceivables: z.boolean().optional(),
    installmentCount: z.number().int().min(0).max(MAX_INSTALLMENTS).nullable().optional(),
    entryDueDays: z.number().int().min(0).max(MAX_DUE_DAYS).nullable().optional(),
    firstInstallmentDueDays: z.number().int().min(0).max(MAX_DUE_DAYS).nullable().optional(),
    createBriefing: z.boolean().optional(),
    createProject: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export type UpdatePostSaleSettingsRequest = z.infer<typeof updatePostSaleSettingsSchema>;
