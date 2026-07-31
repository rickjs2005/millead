import { describe, expect, it } from "vitest";
import { computeEstimate } from "./estimate-calc.js";

const BASE = {
  hourlyRate: 120,
  hoursBreakdown: [
    { label: "Design", hours: 10 },
    { label: "Frontend", hours: 25 },
    { label: "Testes", hours: 7 },
  ],
  costItems: [
    { amount: 20, currency: "USD", billingCycle: "MONTHLY" },
    { amount: 40, currency: "BRL", billingCycle: "YEARLY" },
  ],
  agencyShareMonthly: 80,
  infraMonths: 12,
  supportReservePct: 10,
  marginPct: 30,
  usdToBrlRate: 5,
  domainYears: null,
  domainYearPriceBrl: 0,
} as const;

describe("computeEstimate", () => {
  it("caso da spec: horas, infra snapshotada, rateio, reserva e margem", () => {
    const r = computeEstimate({ ...BASE, hoursBreakdown: [...BASE.hoursBreakdown], costItems: [...BASE.costItems] });
    expect(r.totalHours).toBe(42);
    expect(r.devCost).toBe(42 * 120); // 5040
    expect(r.infraMonthlyBrl).toBeCloseTo(100 + 40 / 12, 2); // 103.33
    expect(r.oneTimeCost).toBe(0);
    expect(r.infraCost).toBeCloseTo((103.333333 + 80) * 12, 1); // 2200
    expect(r.supportReserve).toBeCloseTo(504, 2);
    expect(r.domainCost).toBe(0);
    expect(r.totalCost).toBeCloseTo(5040 + 2200 + 504, 1); // 7744
    expect(r.priceMin).toBeCloseTo(r.totalCost, 5);
    expect(r.priceRecommended).toBeCloseTo(r.totalCost * 1.3, 1);
    expect(r.pricePremium).toBeCloseTo(r.totalCost * 1.45, 1);
  });

  it("orçamento vazio não explode", () => {
    const r = computeEstimate({ ...BASE, hoursBreakdown: [], costItems: [], agencyShareMonthly: 0, supportReservePct: 0, marginPct: 0 });
    expect(r.devCost).toBe(0);
    expect(r.oneTimeCost).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.priceRecommended).toBe(0);
  });

  it("infraMonths zero anula infra (projeto sem hospedagem contratada)", () => {
    const r = computeEstimate({ ...BASE, hoursBreakdown: [...BASE.hoursBreakdown], costItems: [...BASE.costItems], infraMonths: 0 });
    expect(r.infraCost).toBe(0);
    expect(r.totalCost).toBeCloseTo(5040 + 504, 1);
  });

  it("item one-time soma 1x em infraCost, sem multiplicar por infraMonths", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [{ amount: 239, currency: "BRL", billingCycle: "MONTHLY", isOneTime: true }],
      agencyShareMonthly: 0,
    });
    expect(r.infraMonthlyBrl).toBe(0);
    expect(r.oneTimeCost).toBe(239);
    expect(r.infraCost).toBe(239); // (0 + 0) * 12 + 239, NÃO 239 * 12
  });

  it("mistura item mensal e one-time -- só o mensal multiplica por infraMonths", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [
        { amount: 100, currency: "BRL", billingCycle: "MONTHLY" }, // isOneTime ausente = false
        { amount: 239, currency: "BRL", billingCycle: "MONTHLY", isOneTime: true },
      ],
      agencyShareMonthly: 0,
      infraMonths: 12,
    });
    expect(r.infraMonthlyBrl).toBe(100);
    expect(r.oneTimeCost).toBe(239);
    expect(r.infraCost).toBeCloseTo(100 * 12 + 239, 5);
  });

  it("item one-time em USD converte pelo câmbio antes de somar 1x", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [{ amount: 10, currency: "USD", billingCycle: "MONTHLY", isOneTime: true }],
      agencyShareMonthly: 0,
      usdToBrlRate: 5,
    });
    expect(r.oneTimeCost).toBe(50);
    expect(r.infraCost).toBe(50);
  });

  it("item one-time IGNORA billingCycle -- YEARLY não divide por 12 (bug real: R$1200 não pode virar R$100)", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [{ amount: 1200, currency: "BRL", billingCycle: "YEARLY", isOneTime: true }],
      agencyShareMonthly: 0,
    });
    expect(r.oneTimeCost).toBe(1200);
    expect(r.infraCost).toBe(1200);
  });

  it("item one-time USD + YEARLY -- converte moeda, ainda ignora o ciclo", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [{ amount: 100, currency: "USD", billingCycle: "YEARLY", isOneTime: true }],
      agencyShareMonthly: 0,
      usdToBrlRate: 5,
    });
    expect(r.oneTimeCost).toBe(500);
    expect(r.infraCost).toBe(500);
  });

  it("domínio: 2 anos × R$40/ano soma 80 no totalCost -- campo próprio, fora de infraCost/oneTimeCost", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [...BASE.costItems],
      domainYears: 2,
      domainYearPriceBrl: 40,
    });
    expect(r.domainCost).toBe(80);
    expect(r.infraCost).toBeCloseTo((103.333333 + 80) * 12, 1); // domínio não mexe em infraCost
    expect(r.totalCost).toBeCloseTo(5040 + 2200 + 504 + 80, 1);
  });

  it("domainYears null zera domainCost mesmo com domainYearPriceBrl > 0", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [...BASE.costItems],
      domainYears: null,
      domainYearPriceBrl: 40,
    });
    expect(r.domainCost).toBe(0);
    expect(r.totalCost).toBeCloseTo(5040 + 2200 + 504, 1);
  });
});
