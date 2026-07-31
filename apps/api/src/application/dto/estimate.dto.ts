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
  leadId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  hourlyRate: money,
  hoursBreakdown: z.array(hoursLineSchema).max(20),
  costItems: z.array(costItemSchema).max(30),
  agencyShareMonthly: money,
  infraMonths: z.number().int().min(0).max(60),
  supportReservePct: z.number().min(0).max(100),
  marginPct: z.number().min(0).max(500),
  scopeItems: z.array(z.string().min(1).max(120)).max(30),
  deadlineDays: z.number().int().min(1).max(365),
  paymentTerms: z.string().min(1).max(200),
  validDays: z.number().int().min(1).max(90),
  status: z.enum(["DRAFT", "READY", "CONVERTED"]).optional(),
});
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;

export const updateEstimateSchema = createEstimateSchema.partial();
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;

export const listEstimatesQuerySchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "READY", "CONVERTED"]).optional(),
});
export type ListEstimatesQuery = z.infer<typeof listEstimatesQuerySchema>;
