import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSubscription, CostUsageEntry, FinanceSettings } from "../../domain/entities/cost.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import {
  CostService,
  monthlyAmountBrl,
  computeSummary,
  computeCapacity,
  computeUsageSummary,
  currentMonthInTimeZone,
  needsUsdRateRefresh,
  parseUsdRateBid,
  type UsdRateFetcher,
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
    unitPriceBrl: null,
    ...overrides,
  };
}

function fakeSettings(overrides: Partial<FinanceSettings> = {}): FinanceSettings {
  return {
    id: "set-1",
    organizationId: ORG,
    usdToBrlRate: "5.00",
    // Default `false`/`null` de propósito -- é um fixture de teste, não o
    // default de produção (que é `true`, ver schema.prisma). Deixar o
    // fetcher OFF por padrão evita que testes de outras features disparem o
    // fetch real (ou um mock que não existe) sem querer; os testes de
    // refresh lazy abaixo sobrescrevem explicitamente.
    usdRateAuto: false,
    usdRateUpdatedAt: null,
    defaultHourlyRate: "120",
    supportReservePct: "10",
    defaultMarginPct: "30",
    activeClientsCount: 2,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeRepos(costOverrides: Partial<CostRepository> = {}, rateFetcher?: UsdRateFetcher) {
  const costs = {
    listSubscriptions: vi.fn().mockResolvedValue([]),
    findSubscriptionById: vi.fn().mockResolvedValue(null),
    createSubscription: vi.fn().mockResolvedValue(fakeSubscription()),
    updateSubscription: vi.fn().mockResolvedValue(null),
    deleteSubscription: vi.fn().mockResolvedValue(false),
    hasUsageForSubscription: vi.fn().mockResolvedValue(false),
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
  const service =
    rateFetcher !== undefined
      ? new CostService(costs, companies, rateFetcher)
      : new CostService(costs, companies);
  return { costs, companies, service };
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
      [{ subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 400, unitPriceBrl: null }],
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
        { subscriptionId: "sub-hf", companyId: "company-1", companyName: "Cliente A", credits: 300, unitPriceBrl: null },
        { subscriptionId: "sub-hf", companyId: "company-1", companyName: "Cliente A", credits: 100, unitPriceBrl: null },
        { subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 50, unitPriceBrl: null },
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
      [{ subscriptionId: "sub-nc", companyId: null, companyName: null, credits: 20, unitPriceBrl: null }],
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
        { subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 100, unitPriceBrl: null },
        { subscriptionId: "sub-2", companyId: null, companyName: null, credits: 50, unitPriceBrl: null },
      ],
      [higgsfield, { ...higgsfield, id: "sub-2", name: "Higgsfield 2", amount: 478, creditsIncluded: 2000 }],
      5,
    );
    expect(s.unitPriceBrl).toBeNull();
    expect(s.bySubscription).toHaveLength(2);
  });

  it("lançamento com unitPriceBrl gravado usa o preço da HORA, não o preço atual da assinatura", () => {
    // Assinatura hoje custa o dobro (478) do que custava quando o
    // lançamento foi gravado (239 -> unitPriceBrl 0.239 no snapshot).
    const higgsfieldMaisCaro = { ...higgsfield, amount: 478 };
    const s = computeUsageSummary(
      [{ subscriptionId: "sub-hf", companyId: null, companyName: null, credits: 400, unitPriceBrl: 0.239 }],
      [higgsfieldMaisCaro],
      5,
    );
    // costBrl usa o snapshot (0.239), não o preço atual derivado (0.478).
    expect(s.bySubscription[0]!.costBrl).toBeCloseTo(400 * 0.239, 6);
    // unitPriceBrl no resumo por assinatura é só informativo/atual.
    expect(s.bySubscription[0]!.unitPriceBrl).toBeCloseTo(0.478, 3);
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

  it("deleteSubscription lança ConflictError e não apaga quando há uso registrado", async () => {
    const { service, costs } = fakeRepos({
      hasUsageForSubscription: vi.fn().mockResolvedValue(true),
    });
    await expect(service.deleteSubscription(ORG, "sub-x")).rejects.toThrow(ConflictError);
    expect(costs.deleteSubscription).not.toHaveBeenCalled();
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
    it("listUsage com mês explícito filtra by from/to em UTC (usedAt é date-only)", async () => {
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
        findSubscriptionById: vi.fn().mockResolvedValue(fakeSubscription({ creditsIncluded: 1000 })),
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
        findSubscriptionById: vi.fn().mockResolvedValue(fakeSubscription({ creditsIncluded: 1000 })),
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

    it("createUsage rejeita lançamento contra assinatura sem creditsIncluded, sem gravar", async () => {
      const { service, costs } = fakeRepos({
        findSubscriptionById: vi.fn().mockResolvedValue(fakeSubscription({ creditsIncluded: null })),
      });
      await expect(
        service.createUsage(ORG, {
          subscriptionId: "sub-1",
          credits: 10,
          usedAt: new Date("2026-07-15"),
        }),
      ).rejects.toThrow(ValidationError);
      expect(costs.createUsage).not.toHaveBeenCalled();
    });

    it("createUsage grava o unitPriceBrl calculado NA HORA (snapshot), não confia em recálculo futuro", async () => {
      const { service, costs } = fakeRepos({
        findSubscriptionById: vi.fn().mockResolvedValue(
          fakeSubscription({ amount: "239", currency: "BRL", billingCycle: "MONTHLY", creditsIncluded: 1000 }),
        ),
        getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
      });
      await service.createUsage(ORG, {
        subscriptionId: "sub-1",
        credits: 10,
        usedAt: new Date("2026-07-15"),
      });
      expect(costs.createUsage).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ subscriptionId: "sub-1", credits: 10, unitPriceBrl: 0.239 }),
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

describe("CostService.getUsageSeries", () => {
  const higgsfield = fakeSubscription({
    id: "sub-hf",
    name: "Higgsfield",
    scope: "AGENCY",
    amount: "239",
    currency: "BRL",
    billingCycle: "MONTHLY",
    creditsIncluded: 1000,
  });

  it("lançamentos em meses distintos caem nos buckets certos por usedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z")); // America/Sao_Paulo: 2026-07

    const { service } = fakeRepos({
      listUsage: vi.fn().mockResolvedValue([
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 100, usedAt: new Date("2026-05-10"), unitPriceBrl: null }),
        // Dia 1 à meia-noite UTC -- valor REAL que o front manda pra um
        // lançamento do dia 1/07 (usedAt é date-only, sempre T00:00:00Z);
        // precisa continuar caindo em julho (corte UTC, não SP).
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 10, usedAt: new Date("2026-07-01"), unitPriceBrl: null }),
      ]),
      listSubscriptions: vi.fn().mockResolvedValue([higgsfield]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
    });

    const result = await service.getUsageSeries(ORG, 3);

    expect(result.months.map((m) => m.month)).toEqual(["2026-05", "2026-06", "2026-07"]);
    const may = result.months.find((m) => m.month === "2026-05")!;
    const june = result.months.find((m) => m.month === "2026-06")!;
    const july = result.months.find((m) => m.month === "2026-07")!;
    expect(may.usageCostBrl).toBeCloseTo(100 * 0.239, 6);
    expect(june.usageCostBrl).toBe(0);
    expect(july.usageCostBrl).toBeCloseTo(10 * 0.239, 6);

    vi.useRealTimers();
  });

  it("zero-fill: mês sem lançamento vem com usageCostBrl 0 e a série tem exatamente N entradas em ordem cronológica", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z")); // America/Sao_Paulo: 2026-08

    const { service } = fakeRepos({ listUsage: vi.fn().mockResolvedValue([]) });

    const result = await service.getUsageSeries(ORG, 5);

    expect(result.months).toHaveLength(5);
    expect(result.months.map((m) => m.month)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    for (const point of result.months) {
      expect(point.usageCostBrl).toBe(0);
    }
    expect(result.yearTotal).toBe(0);

    vi.useRealTimers();
  });

  it("custo por entrada usa o snapshot unitPriceBrl quando presente e deriva da assinatura quando ausente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));

    // Assinatura hoje custa o dobro (478) do que custava quando o lançamento
    // com snapshot foi gravado (239 -> unitPriceBrl 0.239).
    const higgsfieldMaisCaro = { ...higgsfield, amount: "478" };
    const { service } = fakeRepos({
      listUsage: vi.fn().mockResolvedValue([
        // Com snapshot: usa 0.239, IGNORA o preço atual (0.478).
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 400, usedAt: new Date("2026-07-05"), unitPriceBrl: 0.239 }),
        // Sem snapshot: deriva do preço atual da assinatura (478/1000=0.478).
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 100, usedAt: new Date("2026-07-10"), unitPriceBrl: null }),
      ]),
      listSubscriptions: vi.fn().mockResolvedValue([higgsfieldMaisCaro]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
    });

    const result = await service.getUsageSeries(ORG, 1);

    expect(result.months).toEqual([
      { month: "2026-07", usageCostBrl: 400 * 0.239 + 100 * 0.478 },
    ]);

    vi.useRealTimers();
  });

  it("yearTotal soma só o ano corrente, mesmo com lançamentos de anos anteriores dentro da janela de busca", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00Z")); // America/Sao_Paulo: 2026-02

    const { service } = fakeRepos({
      listUsage: vi.fn().mockResolvedValue([
        // Fora do ano corrente (2025) -- aparece no bucket mensal, não em yearTotal.
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 100, usedAt: new Date("2025-12-01"), unitPriceBrl: null }),
        // Dentro do ano corrente.
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 50, usedAt: new Date("2026-02-05"), unitPriceBrl: null }),
      ]),
      listSubscriptions: vi.fn().mockResolvedValue([higgsfield]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
    });

    const result = await service.getUsageSeries(ORG, 12);

    expect(result.yearTotal).toBeCloseTo(50 * 0.239, 6);
    const dec2025 = result.months.find((m) => m.month === "2025-12");
    expect(dec2025?.usageCostBrl).toBeCloseTo(100 * 0.239, 6);

    vi.useRealTimers();
  });

  it("janela de N meses busca o repo com from/to cobrindo a janela + o ano corrente inteiro (union)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z")); // America/Sao_Paulo: 2026-08

    const { service, costs } = fakeRepos();

    await service.getUsageSeries(ORG, 3);

    // A janela dos 3 meses seria jun/2026..set/2026, mas o ano corrente
    // (jan/2026..jan/2027) prevalece em ambas as pontas.
    expect(costs.listUsage).toHaveBeenCalledWith(ORG, {
      from: new Date(Date.UTC(2026, 0, 1)),
      to: new Date(Date.UTC(2027, 0, 1)),
    });

    vi.useRealTimers();
  });

  it("usedAt é date-only (sempre T00:00:00Z) -- lançamento do dia 1 cai no bucket do mês do dia 1, não do mês anterior (corte fica em UTC puro, não em Brasília)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z")); // America/Sao_Paulo: 2026-09

    const { service } = fakeRepos({
      listUsage: vi.fn().mockResolvedValue([
        // Valor REAL que o front manda pra um lançamento do dia 1/09.
        fakeUsageEntry({ subscriptionId: "sub-hf", credits: 10, usedAt: new Date("2026-09-01"), unitPriceBrl: null }),
      ]),
      listSubscriptions: vi.fn().mockResolvedValue([higgsfield]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
    });

    const result = await service.getUsageSeries(ORG, 2);

    const august = result.months.find((m) => m.month === "2026-08")!;
    const september = result.months.find((m) => m.month === "2026-09")!;
    expect(august.usageCostBrl).toBe(0);
    expect(september.usageCostBrl).toBeCloseTo(10 * 0.239, 6);

    vi.useRealTimers();
  });

  it("recurringMonthlyBrl é a mesma soma de getSummary (totalMonthlyBrl)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));

    const { service } = fakeRepos({
      listUsage: vi.fn().mockResolvedValue([]),
      listSubscriptions: vi.fn().mockResolvedValue([
        fakeSubscription({ id: "sub-1", scope: "AGENCY", amount: "550", isActive: true }),
        fakeSubscription({ id: "sub-2", scope: "CLIENT", amount: "100", isActive: true }),
        fakeSubscription({ id: "sub-3", scope: "AGENCY", amount: "999", isActive: false }),
      ]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00" })),
    });

    const result = await service.getUsageSeries(ORG, 1);

    expect(result.recurringMonthlyBrl).toBeCloseTo(650, 2);

    vi.useRealTimers();
  });
});

describe("parseUsdRateBid", () => {
  it("aceita bid numérico dentro de 1..20", () => {
    expect(parseUsdRateBid("5.4321")).toBeCloseTo(5.4321, 4);
    expect(parseUsdRateBid(5.4321)).toBeCloseTo(5.4321, 4);
  });

  it("descarta bid fora do intervalo 1..20 (sanidade -- API fora do ar/bugada não pode injetar lixo)", () => {
    expect(parseUsdRateBid("0.99")).toBeNull();
    expect(parseUsdRateBid("20.01")).toBeNull();
    expect(parseUsdRateBid("0")).toBeNull();
    expect(parseUsdRateBid("-5")).toBeNull();
  });

  it("aceita os limites 1 e 20", () => {
    expect(parseUsdRateBid("1")).toBe(1);
    expect(parseUsdRateBid("20")).toBe(20);
  });

  it("descarta valor não numérico ou ausente", () => {
    expect(parseUsdRateBid("abc")).toBeNull();
    expect(parseUsdRateBid(undefined)).toBeNull();
    expect(parseUsdRateBid(null)).toBeNull();
    expect(parseUsdRateBid("")).toBeNull();
  });
});

describe("needsUsdRateRefresh", () => {
  const NOW = new Date("2026-08-09T12:00:00Z");

  it("usdRateAuto false -> nunca precisa, mesmo sem updatedAt", () => {
    expect(needsUsdRateRefresh({ usdRateAuto: false, usdRateUpdatedAt: null }, NOW)).toBe(false);
  });

  it("usdRateAuto true + updatedAt null -> precisa", () => {
    expect(needsUsdRateRefresh({ usdRateAuto: true, usdRateUpdatedAt: null }, NOW)).toBe(true);
  });

  it("usdRateAuto true + updatedAt há 23h -> NÃO precisa", () => {
    const updatedAt = new Date(NOW.getTime() - 23 * 60 * 60 * 1000);
    expect(needsUsdRateRefresh({ usdRateAuto: true, usdRateUpdatedAt: updatedAt }, NOW)).toBe(false);
  });

  it("usdRateAuto true + updatedAt há 25h -> precisa", () => {
    const updatedAt = new Date(NOW.getTime() - 25 * 60 * 60 * 1000);
    expect(needsUsdRateRefresh({ usdRateAuto: true, usdRateUpdatedAt: updatedAt }, NOW)).toBe(true);
  });
});

describe("CostService -- cotação USD-BRL automática (refresh lazy no read)", () => {
  it("usdRateAuto true + updatedAt null -> chama o fetcher e persiste rate+timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
    try {
      const rateFetcher = vi.fn().mockResolvedValue(5.42);
      const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
      const refreshed = fakeSettings({
        usdToBrlRate: "5.42",
        usdRateAuto: true,
        usdRateUpdatedAt: new Date("2026-08-09T12:00:00Z"),
      });
      const { service, costs } = fakeRepos(
        {
          getSettings: vi.fn().mockResolvedValue(settings),
          updateSettings: vi.fn().mockResolvedValue(refreshed),
        },
        rateFetcher,
      );

      const result = await service.getSettings(ORG);

      expect(rateFetcher).toHaveBeenCalledTimes(1);
      expect(costs.updateSettings).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ usdToBrlRate: 5.42, usdRateUpdatedAt: new Date("2026-08-09T12:00:00Z") }),
      );
      expect(result).toBe(refreshed);
    } finally {
      vi.useRealTimers();
    }
  });

  it("usdRateAuto true + updatedAt >24h -> chama o fetcher", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
    try {
      const rateFetcher = vi.fn().mockResolvedValue(5.5);
      const settings = fakeSettings({
        usdRateAuto: true,
        usdRateUpdatedAt: new Date("2026-08-08T11:00:00Z"), // 25h atrás
      });
      const { service, costs } = fakeRepos(
        { getSettings: vi.fn().mockResolvedValue(settings) },
        rateFetcher,
      );

      await service.getSettings(ORG);

      expect(rateFetcher).toHaveBeenCalledTimes(1);
      expect(costs.updateSettings).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("usdRateAuto true + updatedAt <24h -> NÃO chama o fetcher, retorna o valor persistido", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
    try {
      const rateFetcher = vi.fn();
      const settings = fakeSettings({
        usdRateAuto: true,
        usdRateUpdatedAt: new Date("2026-08-09T00:00:00Z"), // 12h atrás
      });
      const { service, costs } = fakeRepos(
        { getSettings: vi.fn().mockResolvedValue(settings) },
        rateFetcher,
      );

      const result = await service.getSettings(ORG);

      expect(rateFetcher).not.toHaveBeenCalled();
      expect(costs.updateSettings).not.toHaveBeenCalled();
      expect(result).toBe(settings);
    } finally {
      vi.useRealTimers();
    }
  });

  it("usdRateAuto false -> NÃO chama o fetcher independente de updatedAt", async () => {
    const rateFetcher = vi.fn();
    const settings = fakeSettings({ usdRateAuto: false, usdRateUpdatedAt: null });
    const { service, costs } = fakeRepos({ getSettings: vi.fn().mockResolvedValue(settings) }, rateFetcher);

    const result = await service.getSettings(ORG);

    expect(rateFetcher).not.toHaveBeenCalled();
    expect(costs.updateSettings).not.toHaveBeenCalled();
    expect(result).toBe(settings);
  });

  it("fetcher rejeita -> mantém o valor persistido, NUNCA lança, loga warn", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rateFetcher = vi.fn().mockRejectedValue(new Error("timeout de rede"));
      const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
      const { service, costs } = fakeRepos(
        { getSettings: vi.fn().mockResolvedValue(settings) },
        rateFetcher,
      );

      await expect(service.getSettings(ORG)).resolves.toBe(settings);
      expect(costs.updateSettings).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("fetcher resolve null (ex.: bid inválido/API fora do ar) -> mantém o valor persistido sem lançar", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rateFetcher = vi.fn().mockResolvedValue(null);
      const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
      const { service, costs } = fakeRepos(
        { getSettings: vi.fn().mockResolvedValue(settings) },
        rateFetcher,
      );

      await expect(service.getSettings(ORG)).resolves.toBe(settings);
      expect(costs.updateSettings).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("duas leituras concorrentes podem disparar 2 fetches -- aceitável; nenhuma delas lança", async () => {
    const rateFetcher = vi.fn().mockResolvedValue(5.6);
    const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
    const { service } = fakeRepos({ getSettings: vi.fn().mockResolvedValue(settings) }, rateFetcher);

    await expect(Promise.all([service.getSettings(ORG), service.getSettings(ORG)])).resolves.toBeDefined();
    expect(rateFetcher).toHaveBeenCalledTimes(2);
  });

  it("getSummary passa pelo mesmo ponto único de leitura de settings (refresh lazy também acontece aqui)", async () => {
    const rateFetcher = vi.fn().mockResolvedValue(5.75);
    const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null, activeClientsCount: 1 });
    const refreshed = fakeSettings({
      usdToBrlRate: "5.75",
      usdRateAuto: true,
      usdRateUpdatedAt: new Date(),
      activeClientsCount: 1,
    });
    const { service } = fakeRepos(
      {
        getSettings: vi.fn().mockResolvedValue(settings),
        updateSettings: vi.fn().mockResolvedValue(refreshed),
      },
      rateFetcher,
    );

    await service.getSummary(ORG);

    expect(rateFetcher).toHaveBeenCalledTimes(1);
  });

  it("getUsageSummary passa pelo mesmo ponto único de leitura de settings", async () => {
    const rateFetcher = vi.fn().mockResolvedValue(5.75);
    const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
    const { service } = fakeRepos(
      {
        getSettings: vi.fn().mockResolvedValue(settings),
        updateSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.75" })),
      },
      rateFetcher,
    );

    await service.getUsageSummary(ORG, "2026-07");

    expect(rateFetcher).toHaveBeenCalledTimes(1);
  });

  it("getUsageSeries passa pelo mesmo ponto único de leitura de settings", async () => {
    const rateFetcher = vi.fn().mockResolvedValue(5.75);
    const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
    const { service } = fakeRepos(
      {
        getSettings: vi.fn().mockResolvedValue(settings),
        updateSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.75" })),
      },
      rateFetcher,
    );

    await service.getUsageSeries(ORG, 1);

    expect(rateFetcher).toHaveBeenCalledTimes(1);
  });

  it("createUsage passa pelo mesmo ponto único de leitura de settings", async () => {
    const rateFetcher = vi.fn().mockResolvedValue(5.75);
    const settings = fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null });
    const { service } = fakeRepos(
      {
        findSubscriptionById: vi.fn().mockResolvedValue(fakeSubscription({ creditsIncluded: 1000 })),
        getSettings: vi.fn().mockResolvedValue(settings),
        updateSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.75" })),
      },
      rateFetcher,
    );

    await service.createUsage(ORG, { subscriptionId: "sub-1", credits: 10, usedAt: new Date("2026-07-15") });

    expect(rateFetcher).toHaveBeenCalledTimes(1);
  });
});

describe("CostService.updateSettings -- PATCH manual vs. cotação automática", () => {
  it("PATCH com usdToBrlRate manual desliga usdRateAuto automaticamente e grava o timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
    try {
      const { service, costs } = fakeRepos();

      await service.updateSettings(ORG, { usdToBrlRate: 5.6 });

      expect(costs.updateSettings).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({
          usdToBrlRate: 5.6,
          usdRateAuto: false,
          usdRateUpdatedAt: new Date("2026-08-09T12:00:00Z"),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("PATCH pode religar usdRateAuto=true explicitamente (sem mexer no rate)", async () => {
    const { service, costs } = fakeRepos();

    await service.updateSettings(ORG, { usdRateAuto: true });

    expect(costs.updateSettings).toHaveBeenCalledWith(ORG, { usdRateAuto: true });
  });

  it("PATCH com rate + usdRateAuto=true explícito respeita o explícito (não força false)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T12:00:00Z"));
    try {
      const { service, costs } = fakeRepos();

      await service.updateSettings(ORG, { usdToBrlRate: 5.6, usdRateAuto: true });

      expect(costs.updateSettings).toHaveBeenCalledWith(
        ORG,
        expect.objectContaining({ usdToBrlRate: 5.6, usdRateAuto: true }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("PATCH que não toca em usdToBrlRate/usdRateAuto não mexe nesses campos", async () => {
    const { service, costs } = fakeRepos();

    await service.updateSettings(ORG, { defaultHourlyRate: 150 });

    expect(costs.updateSettings).toHaveBeenCalledWith(ORG, { defaultHourlyRate: 150 });
  });
});
