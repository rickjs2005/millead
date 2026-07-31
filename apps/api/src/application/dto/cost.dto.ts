import { z } from "zod";

const money = z.number().min(0).max(9_999_999);

export const createCostSubscriptionSchema = z.object({
  name: z.string().min(2).max(80),
  scope: z.enum(["AGENCY", "CLIENT"]),
  amount: money,
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  serviceKey: z.string().max(60).optional().nullable(),
  companyId: z.string().min(1).optional().nullable(),
  capacityLimit: z.number().int().min(0).max(100000).optional().nullable(),
  capacityUsed: z.number().int().min(0).max(100000).optional().nullable(),
  // Créditos/mês do plano (ex.: Higgsfield 1000) -- preço unitário é sempre
  // derivado (monthlyAmountBrl ÷ creditsIncluded), nunca digitado.
  creditsIncluded: z.number().int().min(1).max(10_000_000).optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});
export type CreateCostSubscriptionInput = z.infer<typeof createCostSubscriptionSchema>;

export const updateCostSubscriptionSchema = createCostSubscriptionSchema.partial();
export type UpdateCostSubscriptionInput = z.infer<typeof updateCostSubscriptionSchema>;

// ---------------------------------------------------------------------------
// Consumo de créditos (Fase 5)
// ---------------------------------------------------------------------------

export const createUsageEntrySchema = z.object({
  subscriptionId: z.string().min(1),
  companyId: z.string().min(1).optional().nullable(),
  credits: z.number().int().min(1).max(1_000_000),
  usedAt: z.coerce.date(),
  note: z.string().max(200).optional(),
});
export type CreateUsageEntryInput = z.infer<typeof createUsageEntrySchema>;

export const usageQuerySchema = z.object({
  // "YYYY-MM" -- ausente = mês corrente em America/Sao_Paulo (resolvido no service).
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Formato esperado: YYYY-MM")
    .optional(),
});
export type UsageQuery = z.infer<typeof usageQuerySchema>;

export const updateFinanceSettingsSchema = z.object({
  usdToBrlRate: z.number().min(0.01).max(1000).optional(),
  defaultHourlyRate: money.optional(),
  supportReservePct: z.number().min(0).max(100).optional(),
  defaultMarginPct: z.number().min(0).max(500).optional(),
  activeClientsCount: z.number().int().min(1).max(10000).optional(),
});
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
