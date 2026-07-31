import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

const money = z.number().min(0).max(9_999_999);

export const hoursLineSchema = z.object({
  label: z.string().min(1).max(40),
  hours: z.number().min(0).max(10000),
});
export type HoursLineInput = z.infer<typeof hoursLineSchema>;

export const costItemSchema = z.object({
  label: z.string().min(1).max(80),
  amount: money,
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  subscriptionId: z.string().min(1).optional().nullable(),
});
export type CostItemInput = z.infer<typeof costItemSchema>;

export const createEstimateSchema = z.object({
  title: z.string().min(2).max(80),
  // Nullable já no CREATE (padrão lead.dto.ts:25-26) -- assim o `.partial()`
  // do update herda `null` como "desvincular" sem precisar de schema à parte.
  leadId: z.string().min(1).nullable().optional(),
  productId: z.string().min(1).nullable().optional(),
  hourlyRate: money,
  hoursBreakdown: z.array(hoursLineSchema).max(20),
  costItems: z.array(costItemSchema).max(30),
  // Ausente no CREATE -- o service preenche com o rateio atual (perClientShareBrl).
  agencyShareMonthly: money.optional(),
  infraMonths: z.number().int().min(0).max(60),
  supportReservePct: z.number().min(0).max(100),
  marginPct: z.number().min(0).max(500),
  scopeItems: z.array(z.string().min(1).max(120)).max(30),
  deadlineDays: z.number().int().min(1).max(365),
  paymentTerms: z.string().min(1).max(200),
  validDays: z.number().int().min(1).max(90),
  status: z.enum(["DRAFT", "READY"]).optional(), // CONVERTED só via endpoint de conversão (Fase 3)
});
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;

export const updateEstimateSchema = createEstimateSchema.partial();
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;

export const listEstimatesQuerySchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "READY", "CONVERTED"]).optional(),
});
export type ListEstimatesQuery = z.infer<typeof listEstimatesQuerySchema>;

// Conversão em proposta: o front manda o preço escolhido (mínimo/recomendado/
// premium/custom são decisão de UI) -- o resto vem do próprio orçamento.
export const convertEstimateSchema = z.object({
  price: money.min(1),
});
export type ConvertEstimateInput = z.infer<typeof convertEstimateSchema>;
