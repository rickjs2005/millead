import { describe, expect, it, vi } from "vitest";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSubscription, FinanceSettings } from "../../domain/entities/cost.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { LeadDetail } from "../../domain/entities/lead.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type { PricingEstimateWithItems, ProjectProduct } from "../../domain/entities/estimate.js";
import { NotFoundError } from "../../domain/errors/app-error.js";
import { EstimateService } from "./estimate-service.js";

const ORG = "org-1";
const USER = "user-1";

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

function fakeEstimate(overrides: Partial<PricingEstimateWithItems> = {}): PricingEstimateWithItems {
  return {
    id: "est-1",
    organizationId: ORG,
    leadId: null,
    createdById: USER,
    productId: null,
    proposalId: null,
    title: "Site institucional",
    status: "DRAFT",
    hourlyRate: "120",
    hoursBreakdown: [
      { label: "Design", hours: 10 },
      { label: "Frontend", hours: 25 },
      { label: "Testes", hours: 7 },
    ],
    agencyShareMonthly: "80",
    infraMonths: 12,
    supportReservePct: "10",
    marginPct: "30",
    scopeItems: [],
    deadlineDays: 30,
    paymentTerms: "50% início, 50% entrega",
    validDays: 15,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    costItems: [
      {
        id: "item-1",
        organizationId: ORG,
        estimateId: "est-1",
        subscriptionId: null,
        label: "Vercel Pro",
        amount: "20",
        currency: "USD",
        billingCycle: "MONTHLY",
      },
      {
        id: "item-2",
        organizationId: ORG,
        estimateId: "est-1",
        subscriptionId: null,
        label: "Domínio",
        amount: "40",
        currency: "BRL",
        billingCycle: "YEARLY",
      },
    ],
    ...overrides,
  };
}

function fakeProduct(overrides: Partial<ProjectProduct> = {}): ProjectProduct {
  return {
    id: "prod-1",
    organizationId: null,
    name: "Site institucional",
    priceMin: "3000",
    priceMax: "8000",
    baseHours: 40,
    description: null,
    order: 1,
    isActive: true,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeLead(overrides: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: "lead-1",
    organizationId: ORG,
    companyId: null,
    pipelineStageId: null,
    ownerId: null,
    title: "Lead teste",
    source: "MANUAL",
    status: "OPEN",
    score: null,
    value: null,
    currency: "BRL",
    lostReason: null,
    closedAt: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    contacts: [],
    notes: [],
    tags: [],
    ...overrides,
  };
}

function fakeRepos(overrides: {
  estimates?: Partial<EstimateRepository>;
  costs?: Partial<CostRepository>;
  leads?: Partial<LeadRepository>;
} = {}) {
  const estimates = {
    list: vi.fn().mockResolvedValue({ items: [fakeEstimate()], total: 1 }),
    findById: vi.fn().mockResolvedValue(fakeEstimate()),
    create: vi.fn().mockResolvedValue(fakeEstimate()),
    update: vi.fn().mockResolvedValue(fakeEstimate()),
    delete: vi.fn().mockResolvedValue(true),
    listProducts: vi.fn().mockResolvedValue([fakeProduct()]),
    ...overrides.estimates,
  } as unknown as EstimateRepository;

  const costs = {
    listSubscriptions: vi.fn().mockResolvedValue([fakeSubscription()]),
    findSubscriptionById: vi.fn().mockResolvedValue(null),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    listCatalog: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue(fakeSettings()),
    updateSettings: vi.fn(),
    countWonLeads: vi.fn().mockResolvedValue(4),
    ...overrides.costs,
  } as unknown as CostRepository;

  const leads = {
    findByIdForOrg: vi.fn().mockResolvedValue(fakeLead()),
    ...overrides.leads,
  } as unknown as LeadRepository;

  return { estimates, costs, leads, service: new EstimateService(estimates, costs, leads) };
}

const CREATE_INPUT = {
  title: "Site institucional",
  hourlyRate: 120,
  hoursBreakdown: [
    { label: "Design", hours: 10 },
    { label: "Frontend", hours: 25 },
    { label: "Testes", hours: 7 },
  ],
  costItems: [{ label: "Vercel Pro", amount: 20, currency: "USD" as const, billingCycle: "MONTHLY" as const }],
  agencyShareMonthly: 80,
  infraMonths: 12,
  supportReservePct: 10,
  marginPct: 30,
  scopeItems: [],
  deadlineDays: 30,
  paymentTerms: "50% início, 50% entrega",
  validDays: 15,
};

describe("EstimateService", () => {
  it("create rejeita leadId de outra org sem gravar", async () => {
    const { service, estimates, leads } = fakeRepos({
      leads: { findByIdForOrg: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      service.create(ORG, USER, { ...CREATE_INPUT, leadId: "lead-de-outra-org" }),
    ).rejects.toThrow(NotFoundError);
    expect(leads.findByIdForOrg).toHaveBeenCalledWith("lead-de-outra-org", ORG);
    expect(estimates.create).not.toHaveBeenCalled();
  });

  it("create rejeita subscriptionId inexistente na org sem gravar", async () => {
    const { service, estimates } = fakeRepos();
    await expect(
      service.create(ORG, USER, {
        ...CREATE_INPUT,
        costItems: [
          { label: "Assinatura fantasma", amount: 10, currency: "BRL", billingCycle: "MONTHLY", subscriptionId: "sub-x" },
        ],
      }),
    ).rejects.toThrow(NotFoundError);
    expect(estimates.create).not.toHaveBeenCalled();
  });

  it("create sem agencyShareMonthly puxa o rateio do resumo (perClientShareBrl)", async () => {
    const { service, estimates } = fakeRepos({
      costs: {
        listSubscriptions: vi.fn().mockResolvedValue([
          fakeSubscription({ scope: "AGENCY", amount: "550", currency: "BRL" }),
        ]),
        getSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.00", activeClientsCount: 2 })),
        countWonLeads: vi.fn().mockResolvedValue(3),
      },
    });
    const { agencyShareMonthly: _drop, ...withoutShare } = CREATE_INPUT;
    await service.create(ORG, USER, withoutShare);
    // perClientShareBrl = 550 / 2 = 275
    expect(estimates.create).toHaveBeenCalledWith(
      ORG,
      USER,
      expect.objectContaining({ agencyShareMonthly: 275 }),
    );
  });

  it("get devolve computed coerente (conta verificável)", async () => {
    const { service } = fakeRepos();
    const result = await service.get(ORG, "est-1");
    expect(result.computed.totalHours).toBe(42);
    expect(result.computed.devCost).toBe(42 * 120);
    expect(result.computed.infraMonthlyBrl).toBeCloseTo(100 + 40 / 12, 2);
    expect(result.computed.totalCost).toBeCloseTo(5040 + 2200 + 504, 1);
  });

  it("update lança NotFoundError quando o orçamento não é da org", async () => {
    const { service } = fakeRepos({ estimates: { update: vi.fn().mockResolvedValue(null) } });
    await expect(service.update(ORG, "est-x", { title: "Novo título" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("delete lança NotFoundError quando o repo não encontra", async () => {
    const { service } = fakeRepos({ estimates: { delete: vi.fn().mockResolvedValue(false) } });
    await expect(service.delete(ORG, "est-x")).rejects.toThrow(NotFoundError);
  });

  it("update com leadId null desvincula sem validar ownership", async () => {
    const updated = fakeEstimate({ leadId: null });
    const { service, estimates, leads } = fakeRepos({
      estimates: { update: vi.fn().mockResolvedValue(updated) },
    });
    const result = await service.update(ORG, "est-1", { leadId: null });
    expect(leads.findByIdForOrg).not.toHaveBeenCalled();
    expect(result.leadId).toBeNull();
    expect(estimates.update).toHaveBeenCalledWith(ORG, "est-1", { leadId: null });
  });
});
