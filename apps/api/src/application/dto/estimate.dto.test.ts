import { describe, expect, it } from "vitest";
import {
  convertEstimateSchema,
  costItemSchema,
  createEstimateSchema,
  updateEstimateSchema,
} from "./estimate.dto.js";

describe("costItemSchema", () => {
  it("aceita item one-time com billingCycle MONTHLY", () => {
    const result = costItemSchema.safeParse({
      label: "Higgsfield (1000 créditos)",
      amount: 239,
      billingCycle: "MONTHLY",
      isOneTime: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita item one-time com billingCycle YEARLY -- combinação sem sentido (custo único não tem ciclo)", () => {
    const result = costItemSchema.safeParse({
      label: "Higgsfield (1000 créditos)",
      amount: 239,
      billingCycle: "YEARLY",
      isOneTime: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Custo único deve usar ciclo mensal.");
      expect(result.error.issues[0]?.path).toEqual(["billingCycle"]);
    }
  });

  it("item recorrente (isOneTime ausente) aceita YEARLY normalmente", () => {
    const result = costItemSchema.safeParse({
      label: "Domínio",
      amount: 40,
      billingCycle: "YEARLY",
    });
    expect(result.success).toBe(true);
  });

  it("item recorrente com isOneTime explicitamente false aceita YEARLY normalmente", () => {
    const result = costItemSchema.safeParse({
      label: "Domínio",
      amount: 40,
      billingCycle: "YEARLY",
      isOneTime: false,
    });
    expect(result.success).toBe(true);
  });
});

const CREATE_BASE = {
  title: "Site institucional",
  hourlyRate: 120,
  hoursBreakdown: [{ label: "Design", hours: 10 }],
  costItems: [],
  infraMonths: 12,
  supportReservePct: 10,
  marginPct: 30,
  scopeItems: [],
  deadlineDays: 30,
  paymentTerms: "50% início, 50% entrega",
  validDays: 15,
};

describe("createEstimateSchema -- finalPrice/domainYears/domainYearPriceBrl (Fase 6)", () => {
  it("aceita orçamento sem nenhum dos 3 campos novos (todos opcionais)", () => {
    const result = createEstimateSchema.safeParse(CREATE_BASE);
    expect(result.success).toBe(true);
  });

  it("aceita finalPrice válido (money.min(1))", () => {
    const result = createEstimateSchema.safeParse({ ...CREATE_BASE, finalPrice: 9500 });
    expect(result.success).toBe(true);
  });

  it("rejeita finalPrice abaixo de 1", () => {
    const result = createEstimateSchema.safeParse({ ...CREATE_BASE, finalPrice: 0 });
    expect(result.success).toBe(false);
  });

  it("aceita finalPrice null (explicitamente sem preço decidido)", () => {
    const result = createEstimateSchema.safeParse({ ...CREATE_BASE, finalPrice: null });
    expect(result.success).toBe(true);
  });

  it("aceita domainYears + domainYearPriceBrl juntos", () => {
    const result = createEstimateSchema.safeParse({
      ...CREATE_BASE,
      domainYears: 2,
      domainYearPriceBrl: 40,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita domainYears sem domainYearPriceBrl", () => {
    const result = createEstimateSchema.safeParse({ ...CREATE_BASE, domainYears: 2 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["domainYearPriceBrl"]);
    }
  });

  it("aceita domainYearPriceBrl sem domainYears (o inverso é livre)", () => {
    const result = createEstimateSchema.safeParse({ ...CREATE_BASE, domainYearPriceBrl: 40 });
    expect(result.success).toBe(true);
  });

  it("rejeita domainYears fora do range 1..3", () => {
    const result = createEstimateSchema.safeParse({
      ...CREATE_BASE,
      domainYears: 4,
      domainYearPriceBrl: 40,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateEstimateSchema -- finalPrice/domainYears/domainYearPriceBrl (Fase 6)", () => {
  it("aceita patch parcial vazio", () => {
    const result = updateEstimateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("aceita patch só com finalPrice", () => {
    const result = updateEstimateSchema.safeParse({ finalPrice: 8000 });
    expect(result.success).toBe(true);
  });

  it("aceita patch que desvincula finalPrice com null", () => {
    const result = updateEstimateSchema.safeParse({ finalPrice: null });
    expect(result.success).toBe(true);
  });

  it("rejeita patch com domainYears sem domainYearPriceBrl (mesma regra do create)", () => {
    const result = updateEstimateSchema.safeParse({ domainYears: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["domainYearPriceBrl"]);
    }
  });

  it("aceita patch com os dois campos de domínio juntos", () => {
    const result = updateEstimateSchema.safeParse({ domainYears: 3, domainYearPriceBrl: 45 });
    expect(result.success).toBe(true);
  });

  it("rejeita patch que define domainYearPriceBrl como null sem também definir domainYears como null", () => {
    const result = updateEstimateSchema.safeParse({ domainYearPriceBrl: null });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Remova o domínio junto com o preço por ano.");
      expect(result.error.issues[0]?.path).toEqual(["domainYearPriceBrl"]);
    }
  });

  it("aceita patch que limpa os dois campos de domínio juntos (ambos null)", () => {
    const result = updateEstimateSchema.safeParse({ domainYears: null, domainYearPriceBrl: null });
    expect(result.success).toBe(true);
  });
});

describe("convertEstimateSchema -- price opcional (Fase 6: conversão direta)", () => {
  it("aceita body vazio -- o service resolve finalPrice/priceRecommended", () => {
    const result = convertEstimateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("aceita price explícito", () => {
    const result = convertEstimateSchema.safeParse({ price: 5000 });
    expect(result.success).toBe(true);
  });

  it("rejeita price abaixo de 1 quando informado", () => {
    const result = convertEstimateSchema.safeParse({ price: 0 });
    expect(result.success).toBe(false);
  });
});
