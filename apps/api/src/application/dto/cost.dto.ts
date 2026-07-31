import { z } from "zod";

const money = z.number().min(0).max(9_999_999);

export const createCostSubscriptionSchema = z.object({
  name: z.string().min(2).max(80),
  scope: z.enum(["AGENCY", "CLIENT"]),
  amount: money,
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  serviceKey: z.string().max(60).optional().nullable(),
  companyId: z.string().cuid().optional().nullable(),
  capacityLimit: z.number().int().min(0).max(100000).optional().nullable(),
  capacityUsed: z.number().int().min(0).max(100000).optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});
export type CreateCostSubscriptionInput = z.infer<typeof createCostSubscriptionSchema>;

export const updateCostSubscriptionSchema = createCostSubscriptionSchema.partial();
export type UpdateCostSubscriptionInput = z.infer<typeof updateCostSubscriptionSchema>;

export const updateFinanceSettingsSchema = z.object({
  usdToBrlRate: z.number().min(0.01).max(1000).optional(),
  defaultHourlyRate: money.optional(),
  supportReservePct: z.number().min(0).max(100).optional(),
  defaultMarginPct: z.number().min(0).max(500).optional(),
  activeClientsCount: z.number().int().min(1).max(10000).optional(),
});
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
