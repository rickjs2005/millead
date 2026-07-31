import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSubscription, CostUsageEntry, FinanceSettings } from "../../domain/entities/cost.js";
import { NotFoundError } from "../../domain/errors/app-error.js";
import {
  CostService,
  monthlyAmountBrl,
  computeSummary,
  computeCapacity,
  computeUsageSummary,
  currentMonthInTimeZone,
} from "./cost-service.js";

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
    {
      id: "sub-1",
      name: "Claude Max 5x",
      scope: "AGENCY",
      amount: 550,
      currency: "BRL",
      billingCycle: "MONTHLY",
      isActive: true,
      capacityUsed: null,
      capacityLimit: null,
    },
    {
      id: "sub-2",
      name: "Cursor Pro",
      scope: "AGENCY",
      amount: 239,
      currency: "BRL",
      billingCycle: "MONTHLY",
      isActive: true,
      capacityUsed: null,
      capacityLimit: null,
    },
    {
      id: "sub-3",
      name: "Domínio",
      scope: "AGENCY",
      amount: 40,
      currency: "BRL",
      billingCycle: "YEARLY",
      isActive: true,
      capacityUsed: null,
      capacityLimit: null,
    },
    {
      id: "sub-4",
      name: "Vercel Pro",
      scope: "CLIENT",
      amount: 20,
      currency: "USD",
      billingCycle: "MONTHLY",
      isActive: true,
      capacityUsed: null,
      capacityLimit: null,
    },
    {
      id: "sub-5",
      name: "Inativa",
      scope: "AGENCY",
      amount: 999,
      currency: "BRL",
      billingCycle: "MONTHLY",
      isActive: false,
      capacityUsed: null,
      capacityLimit: null,
    },
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
    expect(s.capacity).toEqual([]);
    expect(s.maxCapacityPct).toBeNull();
  });

  it("nunca divide por zero", () => {
    const s = computeSummary([...subs], { usdToBrlRate: 5, activeClientsCount: 0 }, 0);
    expect(s.perClientShareBrl).toBe(s.agencyMonthlyBrl);
  });
});

describe("computeCapacity", () => {
  const base = {
    scope: "AGENCY" as const,
    amount: 0,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
  };

  it("assinatura 12/15 entra com pct 80", () => {
    const { capacity } = computeCapacity([
      { ...base, id: "s1", name: "Claude", isActive: true, capacityUsed: 12, capacityLimit: 15 },
    ]);
    expect(capacity).toEqual([{ id: "s1", name: "Claude", used: 12, limit: 15, pct: 80 }]);
  });

  it("1/1 dá pct 100", () => {
    const { capacity, maxCapacityPct } = computeCapacity([
      { ...base, id: "s1", name: "Claude", isActive: true, capacityUsed: 1, capacityLimit: 1 },
    ]);
    expect(capacity).toEqual([{ id: "s1", name: "Claude", used: 1, limit: 1, pct: 100 }]);
    expect(maxCapacityPct).toBe(100);
  });

  it("sem capacityUsed ou capacityLimit fica fora da lista", () => {
    const { capacity, maxCapacityPct } = computeCapacity([
      { ...base, id: "s1", name: "Sem used", isActive: true, capacityUsed: null, capacityLimit: 15 },
      { ...base, id: "s2", name: "Sem limit", isActive: true, capacityUsed: 5, capacityLimit: null },
    ]);
    expect(capacity).toEqual([]);
    expect(maxCapacityPct).toBeNull();
  });

  it("assinatura inativa fica fora da lista mesmo com capacidade definida", () => {
    const { capacity } = computeCapacity([
      { ...base, id: "s1", name: "Inativa", isActive: false, capacityUsed: 12, capacityLimit: 15 },
    ]);
    expect(capacity).toEqual([]);
  });

  it("limit 0 fica fora da lista", () => {
    const { capacity } = computeCapacity([
      { ...base, id: "s1", name: "Zerada", isActive: true, capacityUsed: 0, capacityLimit: 0 },
    ]);
    expect(capacity).toEqual([]);
  });

  it("ordena por pct desc", () => {
    const { capacity } = computeCapacity([
      { ...base, id: "low", name: "Baixo", isActive: true, capacityUsed: 1, capacityLimit: 10 },
      { ...base, id: "high", name: "Alto", isActive: true, capacityUsed: 9, capacityLimit: 10 },
      { ...base, id: "mid", name: "Médio", isActive: true, capacityUsed: 5, capacityLimit: 10 },
    ]);
    expect(capacity.map((c) => c.id)).toEqual(["high", "mid", "low"]);
  });

  it("maxCapacityPct é o maior pct da lista", () => {
    const { maxCapacityPct } = computeCapacity([
      { ...base, id: "low", name: "Baixo", isActive: true, capacityUsed: 1, capacityLimit: 10 },
      { ...base, id: "high", name: "Alto", isActive: true, capacityUsed: 9, capacityLimit: 10 },
    ]);
    expect(maxCapacityPct).toBe(90);
  });

  it("lista vazia dá maxCapacityPct null", () => {
    const { capacity, maxCapacityPct } = computeCapacity([]);
    expect(capacity).toEqual([]);
    expect(maxCapacityPct).toBeNull();
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
    creditsIncluded: null,
    isActive: true,
    notes: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeUsageEntry(overrides: Partial<CostUsageEntry> = {}): CostUsageEntry {
  return {
    id: "usage-1",
    organizationId: ORG,
    subscriptionId: "sub-1",
    companyId: null,
    companyName: null,
    credits: 100,
    usedAt: new Date("2026-07-15"),
    note: null,
    createdAt: new Date("2026-07-15"),
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
    listUsage: vi.fn().mockResolvedValue([]),
    createUsage: vi.fn().mockResolvedValue(fakeUsageEntry()),
    deleteUsage: vi.fn().mockResolvedValue(false),
    ...costOverrides,
  } as unknown as CostRepository;
  const companies = {
    findByIdForOrg: vi.fn().mockResolvedValue(null),
  } as unknown as CompanyRepository;
  return { costs, companies, service: new CostService(costs, companies) };
}

describe("currentMonthInTimeZone", () => {
  it("formata YYYY-MM no fuso informado", () => {
    // 2026-07-31T02:00:00Z ainda é 30/06 em UTC-3 (America/Sao_Paulo) -- então
    // o mês corrente lá é junho, mesmo já sendo dia 31 em UTC.
    expect(currentMonthInTimeZone(new Date("2026-07-01T02:00:00Z"))).toBe("2026-06");
    expect(currentMonthInTimeZone(new Date("2026-07-01T12:00:00Z"))).toBe("2026-07");
  });
});

describe("computeUsageSummary", () => {
  const higgsfield = {
    id: "sub-hf",
    name: "Higgsfield",
    amount: 239,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    creditsIncluded: 1000,
  };
  const semCreditos = {
    id: "sub-nc",
    name: "Vercel Pro",
    amount: 100,
    currency: "BRL" as const,
    billingCycle: "MONTHLY" as const,
    creditsIncluded: null,
  };

  it("unitário derivado = monthlyAmountBrl(sub) / creditsIncluded", () => {
    const s = computeUsageSummary(
      [{ subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 400 }],
      [higgsfield],
      5,
    );
    expect(s.bySubscription).toEqual([
      {
        subscriptionId: "sub-hf",
        name: "Higgsfield",
        credits: 400,
        creditsIncluded: 1000,
        unitPriceBrl: 0.239,
        costBrl: 400 * 0.239,
      },
    ]);
    expect(s.unitPriceBrl).toBeCloseTo(0.239, 3);
    expect(s.totalCredits).toBe(400);
  });

  it("agrega por cliente -- companyId null vira 'Sem cliente'", () => {
    const s = computeUsageSummary(
      [
        { subscriptionId: "sub-hf", companyId: "company-1", companyName: "Cliente A", credits: 300 },
        { subscriptionId: "sub-hf", companyId: "company-1", companyName: "Cliente A", credits: 100 },
        { subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 50 },
      ],
      [higgsfield],
      5,
    );
    expect(s.byClient).toEqual([
      { companyId: "company-1", companyName: "Cliente A", credits: 400, costBrl: 400 * 0.239 },
      { companyId: null, companyName: "Sem cliente", credits: 50, costBrl: 50 * 0.239 },
    ]);
    expect(s.totalCredits).toBe(450);
  });

  it("assinatura sem creditsIncluded -> unitPrice null e costBrl 0", () => {
    const s = computeUsageSummary(
      [{ subscriptionId: "sub-nc", companyId: null, companyName: null, credits: 20 }],
      [semCreditos],
      5,
    );
    expect(s.bySubscription).toEqual([
      {
        subscriptionId: "sub-nc",
        name: "Vercel Pro",
        credits: 20,
        creditsIncluded: null,
        unitPriceBrl: null,
        costBrl: 0,
      },
    ]);
    expect(s.unitPriceBrl).toBeNull();
    expect(s.byClient).toEqual([{ companyId: null, companyName: "Sem cliente", credits: 20, costBrl: 0 }]);
  });

  it("mês vazio -- sem lançamentos dá resumo zerado", () => {
    const s = computeUsageSummary([], [higgsfield], 5);
    expect(s).toEqual({ unitPriceBrl: null, totalCredits: 0, bySubscription: [], byClient: [] });
  });

  it("mais de uma assinatura com creditsIncluded no período -> unitPriceBrl de topo fica null (ambíguo)", () => {
    const s = computeUsageSummary(
      [
        { subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 100 },
        { subscriptionId: "sub-2", companyId: null, companyName: null, credits: 50 },
      ],
      [higgsfield, { ...higgsfield, id: "sub-2", name: "Higgsfield 2", amount: 478, creditsIncluded: 2000 }],
      5,
    );
    expect(s.unitPriceBrl).toBeNull();
    expect(s.bySubscription).toHaveLength(2);
  });
});

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
        fakeSubscription({ amount: "550", scope: "AGENCY", capacityUsed: 12, capacityLimit: 15 }),
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
    expect(s.capacity).toEqual([{ id: "sub-1", name: "Claude Max 5x", used: 12, limit: 15, pct: 80 }]);
    expect(s.maxCapacityPct).toBe(80);
  });

  describe("usage", () => {
    it("listUsage com mês explícito filtra by from/to em UTC", async () => {
      const { service, costs } = fakeRepos();
      await service.listUsage(ORG, "2026-07");
      expect(costs.listUsage).toHaveBeenCalledWith(ORG, {
        from: new Date("2026-07-01T00:00:00.000Z"),
        to: new Date("2026-08-01T00:00:00.000Z"),
      });
    });

    it("listUsage sem mês usa o mês corrente (America/Sao_Paulo)", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
      try {
        const { service, costs } = fakeRepos();
        await service.listUsage(ORG);
        expect(costs.listUsage).toHaveBeenCalledWith(ORG, {
          from: new Date("2026-07-01T00:00:00.000Z"),
          to: new Date("2026-08-01T00:00:00.000Z"),
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("createUsage rejeita subscriptionId de outra org sem gravar", async () => {
      const { service, costs } = fakeRepos({ findSubscriptionById: vi.fn().mockResolvedValue(null) });
      await expect(
        service.createUsage(ORG, {
          subscriptionId: "sub-x",
          companyId: null,
          credits: 10,
          usedAt: new Date("2026-07-15"),
        }),
      ).rejects.toThrow(NotFoundError);
      expect(costs.createUsage).not.toHaveBeenCalled();
    });

    it("createUsage rejeita companyId de outra org sem gravar", async () => {
      const { service, costs, companies } = fakeRepos({
        findSubscriptionById: vi.fn().mockResolvedValue(fakeSubscription()),
      });
      await expect(
        service.createUsage(ORG, {
          subscriptionId: "sub-1",
          companyId: "company-de-outra-org",
          credits: 10,
          usedAt: new Date("2026-07-15"),
        }),
      ).rejects.toThrow(NotFoundError);
      expect(companies.findByIdForOrg).toHaveBeenCalledWith("company-de-outra-org", ORG);
      expect(costs.createUsage).not.toHaveBeenCalled();
    });

    it("createUsage sem companyId não consulta companies e grava", async () => {
      const { service, costs, companies } = fakeRepos({
        findSubscriptionById: vi.fn().mockResolvedValue(fakeSubscription()),
      });
      await service.createUsage(ORG, {
        subscriptionId: "sub-1",
        credits: 10,
        usedAt: new Date("2026-07-15"),
      });
      expect(companies.findByIdForOrg).not.toHaveBeenCalled();
      expect(costs.createUsage).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ subscriptionId: "sub-1", credits: 10 }),
      );
    });

    it("deleteUsage lança NotFoundError quando o repo não encontra", async () => {
      const { service } = fakeRepos({ deleteUsage: vi.fn().mockResolvedValue(false) });
      await expect(service.deleteUsage(ORG, "usage-x")).rejects.toThrow(NotFoundError);
    });

    it("getUsageSummary monta o resumo a partir de listUsage/listSubscriptions/getSettings", async () => {
      const { service } = fakeRepos({
        listUsage: vi.fn().mockResolvedValue([
          fakeUsageEntry({ subscriptionId: "sub-1", credits: 400 }),
        ]),
        listSubscriptions: vi.fn().mockResolvedValue([
          fakeSubscription({ id: "sub-1", name: "Higgsfield", amount: "239", creditsIncluded: 1000 }),
        ]),
        getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
      });
      const summary = await service.getUsageSummary(ORG, "2026-07");
      expect(summary.month).toBe("2026-07");
      expect(summary.totalCredits).toBe(400);
      expect(summary.unitPriceBrl).toBeCloseTo(0.239, 3);
      expect(summary.bySubscription).toEqual([
        {
          subscriptionId: "sub-1",
          name: "Higgsfield",
          credits: 400,
          creditsIncluded: 1000,
          unitPriceBrl: 0.239,
          costBrl: 400 * 0.239,
        },
      ]);
    });
  });
});
