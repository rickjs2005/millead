import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSubscription, FinanceSettings } from "../../domain/entities/cost.js";
import { NotFoundError } from "../../domain/errors/app-error.js";
import { CostService, monthlyAmountBrl, computeSummary } from "./cost-service.js";

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

const ORG = "org-1";

function fakeSubscription(overrides: Partial<CostSubscription> = {}): CostSubscription {
  return {
    id: "sub-1",
    organizationId: ORG,
    companyId: null,
    serviceKey: null,
    name: "Claude Max 5x",
    scope: "AGENCY",
    amount: "550",
    currency: "BRL",
    billingCycle: "MONTHLY",
    capacityLimit: null,
    capacityUsed: null,
    isActive: true,
    notes: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeSettings(overrides: Partial<FinanceSettings> = {}): FinanceSettings {
  return {
    id: "set-1",
    organizationId: ORG,
    usdToBrlRate: "5.00",
    defaultHourlyRate: "120",
    supportReservePct: "10",
    defaultMarginPct: "30",
    activeClientsCount: 2,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeRepos(costOverrides: Partial<CostRepository> = {}) {
  const costs = {
    listSubscriptions: vi.fn().mockResolvedValue([]),
    findSubscriptionById: vi.fn().mockResolvedValue(null),
    createSubscription: vi.fn().mockResolvedValue(fakeSubscription()),
    updateSubscription: vi.fn().mockResolvedValue(null),
    deleteSubscription: vi.fn().mockResolvedValue(false),
    listCatalog: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue(fakeSettings()),
    updateSettings: vi.fn().mockResolvedValue(fakeSettings()),
    countWonLeads: vi.fn().mockResolvedValue(0),
    ...costOverrides,
  } as unknown as CostRepository;
  const companies = {
    findByIdForOrg: vi.fn().mockResolvedValue(null),
  } as unknown as CompanyRepository;
  return { costs, companies, service: new CostService(costs, companies) };
}

describe("CostService", () => {
  it("updateSubscription lança NotFoundError quando a assinatura não é da org", async () => {
    const { service } = fakeRepos({ updateSubscription: vi.fn().mockResolvedValue(null) });
    await expect(service.updateSubscription(ORG, "sub-x", { amount: 100 })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("deleteSubscription lança NotFoundError quando o repo não encontra", async () => {
    const { service } = fakeRepos({ deleteSubscription: vi.fn().mockResolvedValue(false) });
    await expect(service.deleteSubscription(ORG, "sub-x")).rejects.toThrow(NotFoundError);
  });

  it("createSubscription rejeita companyId de outra org sem gravar nada", async () => {
    const { service, costs, companies } = fakeRepos();
    await expect(
      service.createSubscription(ORG, {
        name: "Vercel Pro",
        scope: "CLIENT",
        amount: 20,
        currency: "USD",
        billingCycle: "MONTHLY",
        isActive: true,
        companyId: "company-de-outra-org",
      }),
    ).rejects.toThrow(NotFoundError);
    expect(companies.findByIdForOrg).toHaveBeenCalledWith("company-de-outra-org", ORG);
    expect(costs.createSubscription).not.toHaveBeenCalled();
  });

  it("createSubscription sem companyId não consulta companies", async () => {
    const { service, costs, companies } = fakeRepos();
    await service.createSubscription(ORG, {
      name: "Claude Max 5x",
      scope: "AGENCY",
      amount: 550,
      currency: "BRL",
      billingCycle: "MONTHLY",
      isActive: true,
    });
    expect(companies.findByIdForOrg).not.toHaveBeenCalled();
    expect(costs.createSubscription).toHaveBeenCalledWith(ORG, expect.objectContaining({ name: "Claude Max 5x" }));
  });

  it("updateSubscription com companyId null (desvincular) não valida company e atualiza", async () => {
    const updated = fakeSubscription({ companyId: null });
    const { service, companies } = fakeRepos({
      updateSubscription: vi.fn().mockResolvedValue(updated),
    });
    await expect(service.updateSubscription(ORG, "sub-1", { companyId: null })).resolves.toEqual(
      updated,
    );
    expect(companies.findByIdForOrg).not.toHaveBeenCalled();
  });

  it("getSummary converte os Decimais string do repo e monta o resumo", async () => {
    const { service } = fakeRepos({
      listSubscriptions: vi.fn().mockResolvedValue([
        fakeSubscription({ amount: "550", scope: "AGENCY" }),
        fakeSubscription({ id: "sub-2", name: "Vercel Pro", amount: "20", currency: "USD", scope: "CLIENT" }),
        fakeSubscription({ id: "sub-3", name: "Inativa", amount: "999", isActive: false }),
      ]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00", activeClientsCount: 2 })),
      countWonLeads: vi.fn().mockResolvedValue(3),
    });
    const s = await service.getSummary(ORG);
    expect(s.agencyMonthlyBrl).toBeCloseTo(550, 2);
    expect(s.clientMonthlyBrl).toBeCloseTo(100, 2);
    expect(s.totalMonthlyBrl).toBeCloseTo(650, 2);
    expect(s.perClientShareBrl).toBeCloseTo(275, 2);
    expect(s.wonLeadsCount).toBe(3);
    expect(s.activeSubscriptions).toBe(2);
  });
});
