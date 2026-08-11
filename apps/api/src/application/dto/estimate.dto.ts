import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

const money = z.number().min(0).max(9_999_999);

export const hoursLineSchema = z.object({
  label: z.string().min(1).max(40),
  hours: z.number().min(0).max(10000),
});
export type HoursLineInput = z.infer<typeof hoursLineSchema>;

export const costItemSchema = z
  .object({
    label: z.string().min(1).max(80),
    amount: money,
    currency: z.enum(["BRL", "USD"]).default("BRL"),
    billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
    subscriptionId: z.string().min(1).optional().nullable(),
    // Custo único (ex.: créditos estimados de um projeto) -- não multiplica
    // por infraMonths no computeEstimate, some 1x em oneTimeCost. Ignora
    // billingCycle no cálculo (computeEstimate/estimate-calc.ts) -- o refine
    // abaixo é cinto e suspensório pra nem deixar gravar a combinação
    // ambígua (YEARLY não tem sentido pra um custo único).
    isOneTime: z.boolean().default(false),
  })
  .refine((item) => !item.isOneTime || item.billingCycle === "MONTHLY", {
    message: "Custo único deve usar ciclo mensal.",
    path: ["billingCycle"],
  });
export type CostItemInput = z.infer<typeof costItemSchema>;

const baseEstimateSchema = z.object({
  title: z.string().min(2).max(80),
  // Nullable já no CREATE (padrão lead.dto.ts:25-26) -- assim o `.partial()`
  // do update herda `null` como "desvincular" sem precisar de schema à parte.
  leadId: z.string().min(1).nullable().optional(),
  productId: z.string().min(1).nullable().optional(),
  hourlyRate: money,
  hoursBreakdown: z.array(hoursLineSchema).max(20),
  costItems: z.array(costItemSchema).max(30),
  // Ausente no CREATE vira 0 (Fase 5: sem auto-preenchimento -- o rateio é
  // coberto pela margem; o front pode ler /costs/summary e usar o valor
  // atual via botão "usar rateio atual").
  agencyShareMonthly: money.optional(),
  infraMonths: z.number().int().min(0).max(60),
  supportReservePct: z.number().min(0).max(100),
  marginPct: z.number().min(0).max(500),
  scopeItems: z.array(z.string().min(1).max(120)).max(30),
  deadlineDays: z.number().int().min(1).max(365),
  paymentTerms: z.string().min(1).max(200),
  validDays: z.number().int().min(1).max(90),
  status: z.enum(["DRAFT", "READY"]).optional(), // CONVERTED só via endpoint de conversão (Fase 3)
  // Fase 6: preço final decidido pelo dono -- ausente/null usa o preço
  // recomendado calculado (comportamento anterior, preservado no convert).
  finalPrice: money.min(1).optional().nullable(),
  // Domínio contratado por N anos -- campo próprio no cálculo (não é um
  // costItem), fora de infraCost/oneTimeCost. `domainYears` presente exige
  // `domainYearPriceBrl` presente (refine abaixo); o inverso é livre.
  domainYears: z.number().int().min(1).max(3).optional().nullable(),
  domainYearPriceBrl: money.optional().nullable(),
});

export const createEstimateSchema = baseEstimateSchema.refine(
  (data) => data.domainYears == null || data.domainYearPriceBrl != null,
  {
    message: "domainYearPriceBrl é obrigatório quando domainYears é informado.",
    path: ["domainYearPriceBrl"],
  },
);
export type CreateEstimateInput = z.infer<typeof createEstimateSchema>;

export const updateEstimateSchema = baseEstimateSchema.partial().refine(
  (data) => {
    // Se tem domainYears, precisa ter domainYearPriceBrl
    if (data.domainYears != null && data.domainYearPriceBrl == null) {
      return false;
    }
    // Se está setando domainYearPriceBrl como null, precisa também settar domainYears como null
    if (
      "domainYearPriceBrl" in data &&
      data.domainYearPriceBrl == null &&
      data.domainYears !== null
    ) {
      return false;
    }
    return true;
  },
  {
    message: "Remova o domínio junto com o preço por ano.",
    path: ["domainYearPriceBrl"],
  },
);
export type UpdateEstimateInput = z.infer<typeof updateEstimateSchema>;

export const listEstimatesQuerySchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "READY", "CONVERTED"]).optional(),
});
export type ListEstimatesQuery = z.infer<typeof listEstimatesQuerySchema>;

// Conversão em proposta: o front manda o preço escolhido (mínimo/recomendado/
// premium/custom são decisão de UI) -- o resto vem do próprio orçamento.
// Fase 6: `price` fica OPCIONAL -- ausente usa `finalPrice` salvo no
// orçamento (preço decidido pelo dono) e, na ausência dele, o preço
// recomendado calculado (EstimateService.convert resolve essa cascata).
export const convertEstimateSchema = z.object({
  price: money.min(1).optional(),
});
export type ConvertEstimateInput = z.infer<typeof convertEstimateSchema>;
