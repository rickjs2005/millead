import { describe, expect, it, vi } from "vitest";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSubscription, FinanceSettings } from "../../domain/entities/cost.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { LeadDetail } from "../../domain/entities/lead.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { CompanyDetail } from "../../domain/entities/company.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { Organization } from "../../domain/entities/organization.js";
import type { ProposalRepository } from "../../domain/repositories/proposal-repository.js";
import type { Proposal } from "../../domain/entities/proposal.js";
import type { BlobStorage } from "../../domain/services/blob-storage.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type { PricingEstimateWithItems, ProjectProduct } from "../../domain/entities/estimate.js";
import type { ActivityRepository } from "../../domain/repositories/activity-repository.js";
import type { ListEstimatesQuery } from "../dto/estimate.dto.js";
import { ActivityLogger } from "./activity-logger.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import { EstimateService } from "./estimate-service.js";
import { CostService, type UsdRateFetcher } from "./cost-service.js";
import { computeEstimate } from "./estimate-calc.js";

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
    creditsIncluded: null,
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
    finalPrice: null,
    domainYears: null,
    domainYearPriceBrl: null,
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
        isOneTime: false,
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
        isOneTime: false,
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

function fakeCompany(overrides: Partial<CompanyDetail> = {}): CompanyDetail {
  return {
    id: "company-1",
    organizationId: ORG,
    name: "Cliente Empresa Ltda",
    document: null,
    segment: null,
    sizeEstimate: null,
    city: null,
    state: null,
    country: "BR",
    phone: null,
    email: null,
    notes: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    websites: [],
    socials: [],
    ...overrides,
  };
}

function fakeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORG,
    name: "MilWeb",
    slug: "milweb",
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

const PROPOSAL_ID = "cproposal000123456";

function fakeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: PROPOSAL_ID,
    organizationId: ORG,
    leadId: "lead-1",
    createdById: USER,
    title: "Site institucional",
    status: "DRAFT",
    value: "5000",
    currency: "BRL",
    validUntil: new Date("2026-08-15"),
    pdfUrl: null,
    sentAt: null,
    respondedAt: null,
    publicToken: null,
    viewedAt: null,
    decidedAt: null,
    decisionIp: null,
    rejectReason: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeRepos(
  overrides: {
    estimates?: Partial<EstimateRepository>;
    // Partial<CostService> -- EstimateService depende do SERVICE (não do
    // repositório cru), pra passar pelo refresh lazy de cotação (ver
    // EstimateService.costService). O fake abaixo só faz duck-typing das
    // chamadas que o EstimateService realmente faz (getSettings/listSubscriptions);
    // testes de integração com o CostService REAL (que exercitam o refresh de
    // verdade) ficam no describe "cotação USD-BRL" no fim do arquivo.
    costs?: Partial<CostService>;
    leads?: Partial<LeadRepository>;
    companies?: Partial<CompanyRepository>;
    organizations?: Partial<OrganizationRepository>;
    proposals?: Partial<ProposalRepository>;
    blobStorage?: Partial<BlobStorage>;
    renderPdf?: (data: unknown) => Promise<Uint8Array>;
  } = {},
) {
  const estimates = {
    list: vi.fn().mockResolvedValue({ items: [fakeEstimate()], total: 1 }),
    findById: vi.fn().mockResolvedValue(fakeEstimate()),
    create: vi.fn().mockResolvedValue(fakeEstimate()),
    update: vi.fn().mockResolvedValue(fakeEstimate()),
    delete: vi.fn().mockResolvedValue(true),
    listProducts: vi.fn().mockResolvedValue([fakeProduct()]),
    markConverted: vi.fn().mockResolvedValue(undefined),
    ...overrides.estimates,
  } as unknown as EstimateRepository;

  const costs = {
    listSubscriptions: vi.fn().mockResolvedValue([fakeSubscription()]),
    getSettings: vi.fn().mockResolvedValue(fakeSettings()),
    ...overrides.costs,
  } as unknown as CostService;

  const leads = {
    findByIdForOrg: vi.fn().mockResolvedValue(fakeLead()),
    ...overrides.leads,
  } as unknown as LeadRepository;

  const companies = {
    findByIdForOrg: vi.fn().mockResolvedValue(fakeCompany()),
    ...overrides.companies,
  } as unknown as CompanyRepository;

  const organizations = {
    findById: vi.fn().mockResolvedValue(fakeOrganization()),
    ...overrides.organizations,
  } as unknown as OrganizationRepository;

  const proposals = {
    create: vi.fn().mockResolvedValue(fakeProposal()),
    update: vi
      .fn()
      .mockResolvedValue(
        fakeProposal({ pdfUrl: `https://blob.test/proposals/${ORG}/${PROPOSAL_ID}.pdf` }),
      ),
    delete: vi.fn().mockResolvedValue(true),
    findByIdForOrg: vi.fn().mockResolvedValue(fakeProposal()),
    list: vi.fn(),
    ...overrides.proposals,
  } as unknown as ProposalRepository;

  const blobStorage = {
    upload: vi.fn().mockResolvedValue({
      url: `https://blob.test/proposals/${ORG}/${PROPOSAL_ID}.pdf`,
      pathname: `proposals/${ORG}/${PROPOSAL_ID}.pdf`,
    }),
    createClientUploadToken: vi.fn(),
    delete: vi.fn(),
    ...overrides.blobStorage,
  } as unknown as BlobStorage;

  const activityRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    listForLead: vi.fn(),
    listRecentForOrg: vi.fn(),
  } as unknown as ActivityRepository;
  const activityLogger = new ActivityLogger(activityRepository);

  const renderPdf = overrides.renderPdf ?? vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));

  const service = new EstimateService(
    estimates,
    costs,
    leads,
    companies,
    organizations,
    proposals,
    blobStorage,
    activityLogger,
    renderPdf,
  );

  return {
    estimates,
    costs,
    leads,
    companies,
    organizations,
    proposals,
    blobStorage,
    activityRepository,
    renderPdf,
    service,
  };
}

const CREATE_INPUT = {
  title: "Site institucional",
  hourlyRate: 120,
  hoursBreakdown: [
    { label: "Design", hours: 10 },
    { label: "Frontend", hours: 25 },
    { label: "Testes", hours: 7 },
  ],
  costItems: [
    {
      label: "Vercel Pro",
      amount: 20,
      currency: "USD" as const,
      billingCycle: "MONTHLY" as const,
      isOneTime: false,
    },
  ],
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
          {
            label: "Assinatura fantasma",
            amount: 10,
            currency: "BRL",
            billingCycle: "MONTHLY",
            subscriptionId: "sub-x",
            isOneTime: false,
          },
        ],
      }),
    ).rejects.toThrow(NotFoundError);
    expect(estimates.create).not.toHaveBeenCalled();
  });

  it("create sem agencyShareMonthly grava 0 -- Fase 5 removeu o auto-preenchimento", async () => {
    const { service, estimates, costs } = fakeRepos();
    const { agencyShareMonthly: _drop, ...withoutShare } = CREATE_INPUT;
    await service.create(ORG, USER, withoutShare);
    expect(estimates.create).toHaveBeenCalledWith(
      ORG,
      USER,
      expect.objectContaining({ agencyShareMonthly: 0 }),
    );
    // Só UMA leitura de settings (a do withComputed final, pro totalCost da
    // resposta) -- nenhum resumo de custos extra é consultado pra derivar o
    // rateio no CREATE (removido na Fase 5). `countWonLeads` não é mais
    // alcançável daqui (nem sequer é método público do CostService) desde
    // que EstimateService passou a depender do service, não do repositório
    // cru -- essa mesma blindagem de tipo já garante estruturalmente o que
    // esta asserção verificava na prática.
    expect(costs.getSettings).toHaveBeenCalledTimes(1);
  });

  it("create com agencyShareMonthly explícito (mesmo 0) respeita o valor informado", async () => {
    const { service, estimates } = fakeRepos();
    await service.create(ORG, USER, { ...CREATE_INPUT, agencyShareMonthly: 0 });
    expect(estimates.create).toHaveBeenCalledWith(
      ORG,
      USER,
      expect.objectContaining({ agencyShareMonthly: 0 }),
    );
  });

  it("get devolve computed coerente (conta verificável)", async () => {
    const { service } = fakeRepos();
    const result = await service.get(ORG, "est-1");
    expect(result.computed.totalHours).toBe(42);
    expect(result.computed.devCost).toBe(42 * 120);
    expect(result.computed.infraMonthlyBrl).toBeCloseTo(100 + 40 / 12, 2);
    expect(result.computed.oneTimeCost).toBe(0);
    expect(result.computed.totalCost).toBeCloseTo(5040 + 2200 + 504, 1);
  });

  it("get mapeia isOneTime do costItem pro computeEstimate (custo único não multiplica por infraMonths)", async () => {
    const { service } = fakeRepos({
      estimates: {
        findById: vi.fn().mockResolvedValue(
          fakeEstimate({
            costItems: [
              {
                id: "item-hf",
                organizationId: ORG,
                estimateId: "est-1",
                subscriptionId: "sub-1",
                label: "Higgsfield (1000 créditos)",
                amount: "239",
                currency: "BRL",
                billingCycle: "MONTHLY",
                isOneTime: true,
              },
            ],
          }),
        ),
      },
    });
    const result = await service.get(ORG, "est-1");
    expect(result.computed.infraMonthlyBrl).toBe(0);
    expect(result.computed.oneTimeCost).toBe(239);
    // (0 + agencyShareMonthly=80) * infraMonths=12 + 239 (não 239 * 12)
    expect(result.computed.infraCost).toBeCloseTo(80 * 12 + 239, 5);
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

  it("update rejeita orçamento CONVERTED sem chamar repo.update", async () => {
    const { service, estimates } = fakeRepos({
      estimates: {
        findById: vi
          .fn()
          .mockResolvedValue(fakeEstimate({ status: "CONVERTED", proposalId: PROPOSAL_ID })),
      },
    });
    await expect(service.update(ORG, "est-1", { title: "Novo título" })).rejects.toThrow(
      ConflictError,
    );
    expect(estimates.update).not.toHaveBeenCalled();
  });

  it("delete rejeita orçamento CONVERTED sem chamar repo.delete", async () => {
    const { service, estimates } = fakeRepos({
      estimates: {
        findById: vi
          .fn()
          .mockResolvedValue(fakeEstimate({ status: "CONVERTED", proposalId: PROPOSAL_ID })),
      },
    });
    await expect(service.delete(ORG, "est-1")).rejects.toThrow(ConflictError);
    expect(estimates.delete).not.toHaveBeenCalled();
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

  describe("convert", () => {
    it("rejeita orçamento sem leadId sem criar nada", async () => {
      const { service, estimates, proposals } = fakeRepos({
        estimates: { findById: vi.fn().mockResolvedValue(fakeEstimate({ leadId: null })) },
      });
      await expect(service.convert(ORG, USER, "est-1", { price: 5000 })).rejects.toThrow(
        ValidationError,
      );
      expect(proposals.create).not.toHaveBeenCalled();
      expect(estimates.markConverted).not.toHaveBeenCalled();
    });

    it("rejeita orçamento já CONVERTED sem criar nada", async () => {
      const { service, estimates, proposals } = fakeRepos({
        estimates: {
          findById: vi
            .fn()
            .mockResolvedValue(
              fakeEstimate({ leadId: "lead-1", status: "CONVERTED", proposalId: PROPOSAL_ID }),
            ),
        },
      });
      await expect(service.convert(ORG, USER, "est-1", { price: 5000 })).rejects.toThrow(
        ConflictError,
      );
      expect(proposals.create).not.toHaveBeenCalled();
      expect(estimates.markConverted).not.toHaveBeenCalled();
    });

    it("happy path: cria proposal com value=price, gera e sobe o PDF, marca convertido e loga Activity", async () => {
      const { service, estimates, proposals, blobStorage, renderPdf, activityRepository } =
        fakeRepos({
          estimates: { findById: vi.fn().mockResolvedValue(fakeEstimate({ leadId: "lead-1" })) },
          leads: {
            findByIdForOrg: vi.fn().mockResolvedValue(fakeLead({ companyId: "company-1" })),
          },
        });

      const result = await service.convert(ORG, USER, "est-1", { price: 5000 });

      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG,
          leadId: "lead-1",
          createdById: USER,
          title: "Site institucional",
          value: "5000",
          currency: "BRL",
        }),
      );
      expect(renderPdf).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalNumber: expect.stringMatching(/^\d{4}-[A-Z0-9]{6}$/),
          clientName: "Cliente Empresa Ltda",
          finalPrice: 5000,
        }),
      );
      expect(blobStorage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: `proposals/${ORG}/${PROPOSAL_ID}.pdf`,
          contentType: "application/pdf",
        }),
      );
      expect(proposals.update).toHaveBeenCalledWith(
        PROPOSAL_ID,
        ORG,
        expect.objectContaining({ pdfUrl: expect.any(String) }),
      );
      expect(estimates.markConverted).toHaveBeenCalledWith(ORG, "est-1", PROPOSAL_ID);
      expect(activityRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG,
          leadId: "lead-1",
          userId: USER,
          type: "OTHER",
          payload: expect.objectContaining({
            kind: "estimate_converted",
            estimateId: "est-1",
            proposalId: PROPOSAL_ID,
          }),
        }),
      );
      expect(result.proposalId).toBe(PROPOSAL_ID);
      expect(result.pdfUrl).toEqual(expect.any(String));
      expect(result.estimate.id).toBe("est-1");
    });

    it("convert sem body (price ausente) usa finalPrice salvo no orçamento", async () => {
      const { service, proposals, renderPdf } = fakeRepos({
        estimates: {
          findById: vi
            .fn()
            .mockResolvedValue(fakeEstimate({ leadId: "lead-1", finalPrice: "7000" })),
        },
      });

      const result = await service.convert(ORG, USER, "est-1", {});

      expect(proposals.create).toHaveBeenCalledWith(expect.objectContaining({ value: "7000" }));
      expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ finalPrice: 7000 }));
      expect(result.proposalId).toBe(PROPOSAL_ID);
    });

    it("convert sem body e sem finalPrice salvo usa o preço recomendado calculado", async () => {
      const { service, proposals, renderPdf } = fakeRepos({
        estimates: {
          findById: vi.fn().mockResolvedValue(fakeEstimate({ leadId: "lead-1", finalPrice: null })),
        },
      });

      const result = await service.convert(ORG, USER, "est-1", {});

      // Mesma conta que o service faz (toComputed a partir do fixture padrão de
      // fakeEstimate/fakeSettings) -- via computeEstimate direto pra bater
      // bit-a-bit com o float real (evita divergência de ponto flutuante
      // entre recalcular "na mão" e o que o serviço de fato produz).
      const expectedPrice = computeEstimate({
        hourlyRate: 120,
        hoursBreakdown: [
          { label: "Design", hours: 10 },
          { label: "Frontend", hours: 25 },
          { label: "Testes", hours: 7 },
        ],
        costItems: [
          { amount: 20, currency: "USD", billingCycle: "MONTHLY", isOneTime: false },
          { amount: 40, currency: "BRL", billingCycle: "YEARLY", isOneTime: false },
        ],
        agencyShareMonthly: 80,
        infraMonths: 12,
        supportReservePct: 10,
        marginPct: 30,
        usdToBrlRate: 5,
        domainYears: null,
        domainYearPriceBrl: 0,
      }).priceRecommended;

      expect(proposals.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: String(expectedPrice) }),
      );
      expect(renderPdf).toHaveBeenCalledWith(
        expect.objectContaining({ finalPrice: expectedPrice }),
      );
      expect(result.proposalId).toBe(PROPOSAL_ID);
    });

    it("convert com price explícito no body tem prioridade sobre finalPrice salvo", async () => {
      const { service, proposals, renderPdf } = fakeRepos({
        estimates: {
          findById: vi
            .fn()
            .mockResolvedValue(fakeEstimate({ leadId: "lead-1", finalPrice: "7000" })),
        },
      });

      await service.convert(ORG, USER, "est-1", { price: 9999 });

      expect(proposals.create).toHaveBeenCalledWith(expect.objectContaining({ value: "9999" }));
      expect(renderPdf).toHaveBeenCalledWith(expect.objectContaining({ finalPrice: 9999 }));
    });

    it("orçamento com domínio: passa domainYears e domainCostBrl (computed.domainCost) pro PDF", async () => {
      const { service, renderPdf } = fakeRepos({
        estimates: {
          findById: vi.fn().mockResolvedValue(
            fakeEstimate({
              leadId: "lead-1",
              finalPrice: "8000",
              domainYears: 2,
              domainYearPriceBrl: "40",
            }),
          ),
        },
      });

      await service.convert(ORG, USER, "est-1", {});

      expect(renderPdf).toHaveBeenCalledWith(
        expect.objectContaining({ domainYears: 2, domainCostBrl: 80 }),
      );
    });

    it("orçamento sem domínio: domainYears null e domainCostBrl 0 no PDF", async () => {
      const { service, renderPdf } = fakeRepos({
        estimates: { findById: vi.fn().mockResolvedValue(fakeEstimate({ leadId: "lead-1" })) },
      });

      await service.convert(ORG, USER, "est-1", { price: 5000 });

      expect(renderPdf).toHaveBeenCalledWith(
        expect.objectContaining({ domainYears: null, domainCostBrl: 0 }),
      );
    });

    it("falha no upload: remove a proposal criada (cleanup) e não marca o estimate como convertido", async () => {
      const { service, estimates, proposals } = fakeRepos({
        estimates: { findById: vi.fn().mockResolvedValue(fakeEstimate({ leadId: "lead-1" })) },
        blobStorage: { upload: vi.fn().mockRejectedValue(new Error("blob indisponível")) },
      });

      await expect(service.convert(ORG, USER, "est-1", { price: 5000 })).rejects.toThrow(
        "blob indisponível",
      );

      expect(proposals.create).toHaveBeenCalledTimes(1);
      expect(proposals.delete).toHaveBeenCalledWith(PROPOSAL_ID, ORG);
      expect(estimates.markConverted).not.toHaveBeenCalled();
      expect(proposals.update).not.toHaveBeenCalled();
    });

    it("falha no upload E no delete do cleanup: propaga o erro do UPLOAD (causa raiz), não o do cleanup", async () => {
      const { service, estimates, proposals } = fakeRepos({
        estimates: { findById: vi.fn().mockResolvedValue(fakeEstimate({ leadId: "lead-1" })) },
        blobStorage: { upload: vi.fn().mockRejectedValue(new Error("blob indisponível")) },
        proposals: { delete: vi.fn().mockRejectedValue(new Error("db indisponível")) },
      });

      await expect(service.convert(ORG, USER, "est-1", { price: 5000 })).rejects.toThrow(
        "blob indisponível",
      );

      expect(proposals.delete).toHaveBeenCalledWith(PROPOSAL_ID, ORG);
      expect(estimates.markConverted).not.toHaveBeenCalled();
      expect(proposals.update).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// EstimateService precisa passar pelo PONTO ÚNICO de leitura de settings do
// CostService (CostService.readSettings) -- não pelo CostRepository cru --
// senão uma org que só usa Orçamentos/Propostas nunca dispara o refresh lazy
// da cotação USD-BRL (fica congelada no valor seedado pra sempre, em
// silêncio). Os testes acima usam um `costs` de duck-typing simples (só
// getSettings/listSubscriptions mockados); os testes abaixo usam um
// `CostService` DE VERDADE (só o `CostRepository`/`rateFetcher` por baixo
// dele são fakes) pra provar que o fio está ligado ponta a ponta.
// ---------------------------------------------------------------------------
describe("EstimateService -- cotação USD-BRL passa pelo CostService real (refresh lazy)", () => {
  function fakeCostRepository(overrides: Partial<CostRepository> = {}): CostRepository {
    return {
      listSubscriptions: vi.fn().mockResolvedValue([]),
      findSubscriptionById: vi.fn().mockResolvedValue(null),
      createSubscription: vi.fn(),
      updateSubscription: vi.fn(),
      deleteSubscription: vi.fn(),
      hasUsageForSubscription: vi.fn(),
      listCatalog: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue(fakeSettings()),
      updateSettings: vi.fn().mockResolvedValue(fakeSettings()),
      countWonLeads: vi.fn().mockResolvedValue(0),
      listUsage: vi.fn().mockResolvedValue([]),
      createUsage: vi.fn(),
      deleteUsage: vi.fn(),
      ...overrides,
    } as unknown as CostRepository;
  }

  /** Monta um EstimateService "de verdade" (só EstimateRepository e
   * CostService são relevantes pro que os testes abaixo exercitam --
   * list()/get() só tocam esses dois). */
  function estimateServiceWithRealCostService(costService: CostService) {
    const estimates = {
      list: vi.fn().mockResolvedValue({ items: [fakeEstimate()], total: 1 }),
      findById: vi.fn().mockResolvedValue(fakeEstimate()),
      listProducts: vi.fn().mockResolvedValue([]),
    } as unknown as EstimateRepository;
    const leads = { findByIdForOrg: vi.fn() } as unknown as LeadRepository;
    const companies = { findByIdForOrg: vi.fn() } as unknown as CompanyRepository;
    const organizations = { findById: vi.fn() } as unknown as OrganizationRepository;
    const proposals = {} as unknown as ProposalRepository;
    const blobStorage = {} as unknown as BlobStorage;
    const activityRepository = {
      record: vi.fn(),
      listForLead: vi.fn(),
      listRecentForOrg: vi.fn(),
    } as unknown as ActivityRepository;
    const activityLogger = new ActivityLogger(activityRepository);

    return new EstimateService(
      estimates,
      costService,
      leads,
      companies,
      organizations,
      proposals,
      blobStorage,
      activityLogger,
    );
  }

  const LIST_QUERY: ListEstimatesQuery = { page: 1, pageSize: 20 };

  it("list() com usdRateAuto=true e cotação vencida (updatedAt null) dispara o rateFetcher do CostService real", async () => {
    const rateFetcher: UsdRateFetcher = vi.fn().mockResolvedValue(5.75);
    const costRepository = fakeCostRepository({
      getSettings: vi
        .fn()
        .mockResolvedValue(fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null })),
      updateSettings: vi
        .fn()
        .mockResolvedValue(
          fakeSettings({ usdToBrlRate: "5.75", usdRateAuto: true, usdRateUpdatedAt: new Date() }),
        ),
    });
    const companies = { findByIdForOrg: vi.fn() } as unknown as CompanyRepository;
    const costService = new CostService(costRepository, companies, rateFetcher);
    const service = estimateServiceWithRealCostService(costService);

    await service.list(ORG, LIST_QUERY);

    expect(rateFetcher).toHaveBeenCalledTimes(1);
    expect(costRepository.updateSettings).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ usdToBrlRate: 5.75 }),
    );
  });

  it("list() com cotação fresca (<24h) NÃO dispara o rateFetcher -- fio ligado, mas cache respeitado", async () => {
    const rateFetcher: UsdRateFetcher = vi.fn();
    const costRepository = fakeCostRepository({
      getSettings: vi
        .fn()
        .mockResolvedValue(fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: new Date() })),
    });
    const companies = { findByIdForOrg: vi.fn() } as unknown as CompanyRepository;
    const costService = new CostService(costRepository, companies, rateFetcher);
    const service = estimateServiceWithRealCostService(costService);

    await service.list(ORG, LIST_QUERY);

    expect(rateFetcher).not.toHaveBeenCalled();
    expect(costRepository.updateSettings).not.toHaveBeenCalled();
  });

  it("get() (withComputed) também dispara o refresh -- não é só o list()", async () => {
    const rateFetcher: UsdRateFetcher = vi.fn().mockResolvedValue(5.5);
    const costRepository = fakeCostRepository({
      getSettings: vi
        .fn()
        .mockResolvedValue(fakeSettings({ usdRateAuto: true, usdRateUpdatedAt: null })),
      updateSettings: vi.fn().mockResolvedValue(fakeSettings({ usdToBrlRate: "5.5" })),
    });
    const companies = { findByIdForOrg: vi.fn() } as unknown as CompanyRepository;
    const costService = new CostService(costRepository, companies, rateFetcher);
    const service = estimateServiceWithRealCostService(costService);

    await service.get(ORG, "est-1");

    expect(rateFetcher).toHaveBeenCalledTimes(1);
  });
});
