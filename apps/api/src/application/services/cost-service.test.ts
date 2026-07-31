import { describe, expect, it } from "vitest";
import { monthlyAmountBrl, computeSummary } from "./cost-service.js";

describe("monthlyAmountBrl", () => {
  it("mantém BRL mensal como está", () => {
    expect(monthlyAmountBrl(550, "BRL", "MONTHLY", 5.3)).toBe(550);
  });
  it("converte USD pelo câmbio", () => {
    expect(monthlyAmountBrl(20, "USD", "MONTHLY", 5.3)).toBe(106);
  });
  it("divide anual por 12 (2 casas)", () => {
    expect(monthlyAmountBrl(40, "BRL", "YEARLY", 5.3)).toBeCloseTo(3.33, 2);
  });
  it("USD anual: converte e divide", () => {
    expect(monthlyAmountBrl(120, "USD", "YEARLY", 5.0)).toBeCloseTo(50, 2);
  });
});

describe("computeSummary", () => {
  const subs = [
    { scope: "AGENCY", amount: 550, currency: "BRL", billingCycle: "MONTHLY", isActive: true },
    { scope: "AGENCY", amount: 239, currency: "BRL", billingCycle: "MONTHLY", isActive: true },
    { scope: "AGENCY", amount: 40, currency: "BRL", billingCycle: "YEARLY", isActive: true },
    { scope: "CLIENT", amount: 20, currency: "USD", billingCycle: "MONTHLY", isActive: true },
    { scope: "AGENCY", amount: 999, currency: "BRL", billingCycle: "MONTHLY", isActive: false },
  ] as const;

  it("soma só ativos, separa escopos e rateia por clientes ativos", () => {
    const s = computeSummary([...subs], { usdToBrlRate: 5, activeClientsCount: 2 }, 7);
    expect(s.agencyMonthlyBrl).toBeCloseTo(550 + 239 + 40 / 12, 2);
    expect(s.clientMonthlyBrl).toBeCloseTo(100, 2);
    expect(s.totalMonthlyBrl).toBeCloseTo(s.agencyMonthlyBrl + 100, 2);
    expect(s.perClientShareBrl).toBeCloseTo(s.agencyMonthlyBrl / 2, 2);
    expect(s.activeClientsCount).toBe(2);
    expect(s.wonLeadsCount).toBe(7);
    expect(s.activeSubscriptions).toBe(4);
  });

  it("nunca divide por zero", () => {
    const s = computeSummary([...subs], { usdToBrlRate: 5, activeClientsCount: 0 }, 0);
    expect(s.perClientShareBrl).toBe(s.agencyMonthlyBrl);
  });
});
