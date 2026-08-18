import { describe, expect, it, vi } from "vitest";
import type { ActivityRepository } from "../../domain/repositories/activity-repository.js";
import { ActivityLogger } from "./activity-logger.js";
import {
  ConflictError,
  GoneError,
  NotFoundError,
  ValidationError,
} from "../../domain/errors/app-error.js";
import type { Company, CompanyDetail } from "../../domain/entities/company.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { PricingEstimateWithItems } from "../../domain/entities/estimate.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type { LeadContact, LeadDetail } from "../../domain/entities/lead.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { Organization } from "../../domain/entities/organization.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { Proposal } from "../../domain/entities/proposal.js";
import type { ProposalRepository } from "../../domain/repositories/proposal-repository.js";
import type { ProposalNotifier } from "../../domain/services/proposal-notifier.js";
import type { PushSender } from "../../domain/services/push-sender.js";
import type { Contract } from "../../domain/entities/contract.js";
import type { ContractService } from "./contract-service.js";
import { ProposalPublicService } from "./proposal-public-service.js";

const ORG = "org-1";
const PROPOSAL_ID = "cproposal000123456";
const LEAD_ID = "lead-1";
const TOKEN = "PUBLICTOKEN0000000001";

function fakeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: PROPOSAL_ID,
    organizationId: ORG,
    leadId: LEAD_ID,
    createdById: "user-1",
    title: "Site institucional",
    status: "SENT",
    value: "5000.00",
    currency: "BRL",
    validUntil: new Date("2026-12-31"),
    pdfUrl: "https://blob.example/proposal.pdf",
    sentAt: new Date("2026-07-30"),
    respondedAt: null,
    publicToken: TOKEN,
    viewedAt: null,
    decidedAt: null,
    decisionIp: null,
    rejectReason: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeContact(overrides: Partial<LeadContact> = {}): LeadContact {
  return {
    id: "contact-1",
    leadId: LEAD_ID,
    name: "Cliente Teste",
    role: null,
    email: "cliente@teste.com",
    phone: "31999999999",
    isPrimary: true,
    createdAt: new Date("2026-07-31"),
    ...overrides,
  };
}

function fakeLead(overrides: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: LEAD_ID,
    organizationId: ORG,
    companyId: "company-1",
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
    contacts: [fakeContact()],
    notes: [],
    tags: [],
    ...overrides,
  };
}

function fakeCompany(overrides: Partial<Company> = {}): CompanyDetail {
  return {
    id: "company-1",
    organizationId: ORG,
    name: "Cliente LTDA",
    document: "12345678000199",
    segment: null,
    sizeEstimate: null,
    city: null,
    state: null,
    country: "BR",
    phone: "31988888888",
    email: "contato@cliente.com",
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

function fakeEstimate(overrides: Partial<PricingEstimateWithItems> = {}): PricingEstimateWithItems {
  return {
    id: "estimate-1",
    organizationId: ORG,
    leadId: LEAD_ID,
    createdById: "user-1",
    productId: null,
    proposalId: PROPOSAL_ID,
    title: "Orçamento site",
    status: "CONVERTED",
    hourlyRate: "100.00",
    hoursBreakdown: [],
    agencyShareMonthly: "0",
    infraMonths: 12,
    supportReservePct: "10",
    marginPct: "30",
    scopeItems: ["Página inicial", "Página de contato"],
    deadlineDays: 21,
    paymentTerms: "50% para iniciar, 50% na entrega",
    validDays: 15,
    finalPrice: "5000.00",
    domainYears: null,
    domainYearPriceBrl: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-07-31"),
    costItems: [],
    ...overrides,
  };
}

function fakeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    organizationId: ORG,
    companyId: "company-1",
    leadId: LEAD_ID,
    createdById: null,
    proposalId: null,
    numero: "MILWEB-2026-000001",
    tipo: "SITE",
    status: "RASCUNHO",
    descricaoProjeto: "Site institucional",
    valorTotal: "5000.00",
    formaPagamento: "PIX",
    percentualEntrada: "50.00",
    prazoEntregaDias: 21,
    limiteRevisoes: 2,
    contractorSnapshot: {},
    contractedSnapshot: {},
    provider: "MOCK",
    signatureDocId: null,
    signatureUrl: null,
    assinadoEm: null,
    hasPdfOriginal: false,
    hasPdfAssinado: false,
    falhouProcessamento: false,
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date("2026-08-01"),
    ...overrides,
  };
}

function makeService(
  overrides: {
    proposals?: Partial<ProposalRepository>;
    estimates?: Partial<EstimateRepository>;
    leads?: Partial<LeadRepository>;
    companies?: Partial<CompanyRepository>;
    organizations?: Partial<OrganizationRepository>;
    contracts?: Partial<ContractService>;
    notifier?: Partial<ProposalNotifier>;
    push?: Partial<PushSender>;
  } = {},
) {
  const proposals = {
    create: vi.fn(),
    findByIdForOrg: vi.fn().mockResolvedValue(fakeProposal()),
    list: vi.fn(),
    update: vi.fn(),
    ensurePublicToken: vi.fn(),
    delete: vi.fn(),
    findByPublicToken: vi.fn().mockResolvedValue(fakeProposal()),
    markViewed: vi.fn().mockResolvedValue(true),
    decide: vi.fn().mockImplementation(async (_id, decision, data) =>
      fakeProposal({
        status: decision,
        decidedAt: data.decidedAt,
        decisionIp: data.decisionIp,
        respondedAt: data.decidedAt,
        rejectReason: data.rejectReason ?? null,
      }),
    ),
    markExpired: vi.fn().mockResolvedValue(undefined),
    ...overrides.proposals,
  } as unknown as ProposalRepository;

  const estimates = {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listProducts: vi.fn(),
    markConverted: vi.fn(),
    findByProposalId: vi.fn().mockResolvedValue(fakeEstimate()),
    ...overrides.estimates,
  } as unknown as EstimateRepository;

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

  const contracts = {
    createDraftFromProposal: vi.fn().mockResolvedValue(fakeContract()),
    ...overrides.contracts,
  } as unknown as ContractService;

  const activityRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    listForLead: vi.fn(),
    listRecentForOrg: vi.fn(),
  } as unknown as ActivityRepository;
  const activityLogger = new ActivityLogger(activityRepository);

  const notifier = {
    propostaEnviada: vi.fn().mockResolvedValue(undefined),
    propostaDecidida: vi.fn().mockResolvedValue(undefined),
    ...overrides.notifier,
  } as unknown as ProposalNotifier;

  const push = {
    sendToOrg: vi.fn().mockResolvedValue(undefined),
    ...overrides.push,
  } as unknown as PushSender;

  const service = new ProposalPublicService(
    proposals,
    estimates,
    leads,
    companies,
    organizations,
    contracts,
    notifier,
    push,
    activityLogger,
  );

  return {
    service,
    proposals,
    estimates,
    leads,
    companies,
    organizations,
    contracts,
    notifier,
    push,
    activityRepository,
  };
}

describe("ProposalPublicService.getByToken", () => {
  it("token inexistente lança NotFoundError", async () => {
    const { service, proposals } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.getByToken("no-such-token")).rejects.toThrow(NotFoundError);
    expect(proposals.markViewed).not.toHaveBeenCalled();
  });

  it("proposta DRAFT: o repo já filtra e devolve null -- vira NotFoundError também", async () => {
    // findByPublicToken já exclui DRAFT no repo real; aqui simulamos o
    // contrato de que ele devolve null pra token de proposta ainda não enviada.
    const { service } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.getByToken(TOKEN)).rejects.toThrow(NotFoundError);
  });

  it("primeira chamada com status SENT marca VIEWED e loga atividade uma vez", async () => {
    const { service, proposals, activityRepository } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })) },
    });

    const view = await service.getByToken(TOKEN);

    expect(proposals.markViewed).toHaveBeenCalledTimes(1);
    expect(proposals.markViewed).toHaveBeenCalledWith(PROPOSAL_ID, expect.any(Date));
    expect(activityRepository.record).toHaveBeenCalledTimes(1);
    expect((activityRepository.record as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        organizationId: ORG,
        leadId: LEAD_ID,
        userId: null,
        type: "OTHER",
        payload: { kind: "proposal_viewed_public", proposalId: PROPOSAL_ID },
      },
    );
    expect(view.status).toBe("VIEWED");
  });

  it("segunda chamada (status já VIEWED) não re-marca nem loga de novo", async () => {
    const { service, proposals, activityRepository } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "VIEWED" })),
      },
    });

    const view = await service.getByToken(TOKEN);

    expect(proposals.markViewed).not.toHaveBeenCalled();
    expect(activityRepository.record).not.toHaveBeenCalled();
    expect(view.status).toBe("VIEWED");
  });

  it("devolve scopeItems do estimate vinculado", async () => {
    const { service } = makeService();

    const view = await service.getByToken(TOKEN);

    expect(view.scopeItems).toEqual(["Página inicial", "Página de contato"]);
  });

  it("devolve [] quando não há estimate vinculado", async () => {
    const { service } = makeService({
      estimates: { findByProposalId: vi.fn().mockResolvedValue(null) },
    });

    const view = await service.getByToken(TOKEN);

    expect(view.scopeItems).toEqual([]);
  });

  it("monta a vista pública com organização, valor, validade e pdf", async () => {
    const { service } = makeService();

    const view = await service.getByToken(TOKEN);

    expect(view).toMatchObject({
      title: "Site institucional",
      value: "5000.00",
      currency: "BRL",
      organizationName: "MilWeb",
      pdfUrl: "https://blob.example/proposal.pdf",
    });
    expect(view.validUntil).toBe(new Date("2026-12-31").toISOString());
  });

  it("proposta SENT com validUntil no passado: abre já como EXPIRED, sem marcar VIEWED nem logar visualização", async () => {
    const { service, proposals, activityRepository } = makeService({
      proposals: {
        findByPublicToken: vi
          .fn()
          .mockResolvedValue(fakeProposal({ status: "SENT", validUntil: new Date("2020-01-01") })),
      },
    });

    const view = await service.getByToken(TOKEN);

    expect(view.status).toBe("EXPIRED");
    expect(proposals.markExpired).toHaveBeenCalledWith(PROPOSAL_ID);
    expect(proposals.markViewed).not.toHaveBeenCalled();
    expect(activityRepository.record).not.toHaveBeenCalled();
  });

  it("proposta ACCEPTED com validUntil no passado: continua ACCEPTED, não vira EXPIRED", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi
          .fn()
          .mockResolvedValue(
            fakeProposal({ status: "ACCEPTED", validUntil: new Date("2020-01-01") }),
          ),
      },
    });

    const view = await service.getByToken(TOKEN);

    expect(view.status).toBe("ACCEPTED");
    expect(proposals.markExpired).not.toHaveBeenCalled();
  });
});

describe("ProposalPublicService.accept", () => {
  it("de SENT para ACCEPTED: grava decidedAt/ip, cria contrato rascunho, dispara push+e-mail e loga atividade", async () => {
    const { service, proposals, contracts, push, notifier, activityRepository } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })) },
    });

    const result = await service.accept(TOKEN, "1.2.3.4");

    expect(result).toEqual({ status: "ACCEPTED" });
    expect(proposals.decide).toHaveBeenCalledWith(
      PROPOSAL_ID,
      "ACCEPTED",
      expect.objectContaining({ decisionIp: "1.2.3.4" }),
    );
    expect(contracts.createDraftFromProposal).toHaveBeenCalledTimes(1);
    expect(push.sendToOrg).toHaveBeenCalledTimes(1);
    expect(notifier.propostaDecidida).toHaveBeenCalledTimes(1);
    expect((notifier.propostaDecidida as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        decision: "ACCEPTED",
        contractCreated: true,
        contractFailReason: null,
      },
    );
    expect(activityRepository.record).toHaveBeenCalledTimes(1);
    expect((activityRepository.record as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        payload: {
          kind: "proposal_accepted_public",
          proposalId: PROPOSAL_ID,
          contractCreated: true,
        },
      },
    );
  });

  it("de VIEWED para ACCEPTED também funciona", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "VIEWED" })),
      },
    });

    const result = await service.accept(TOKEN, null);

    expect(result).toEqual({ status: "ACCEPTED" });
    expect(proposals.decide).toHaveBeenCalledTimes(1);
  });

  it("proposta expirada (validUntil no passado) lança GoneError e marca EXPIRED", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi
          .fn()
          .mockResolvedValue(fakeProposal({ status: "SENT", validUntil: new Date("2020-01-01") })),
      },
    });

    await expect(service.accept(TOKEN, null)).rejects.toThrow(GoneError);
    expect(proposals.markExpired).toHaveBeenCalledWith(PROPOSAL_ID);
    expect(proposals.decide).not.toHaveBeenCalled();
  });

  it("já ACCEPTED: retorna status sem erro, sem duplicar contrato (idempotente)", async () => {
    const { service, proposals, contracts, push, notifier } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "ACCEPTED" })),
      },
    });

    const result = await service.accept(TOKEN, null);

    expect(result).toEqual({ status: "ACCEPTED" });
    expect(proposals.decide).not.toHaveBeenCalled();
    expect(contracts.createDraftFromProposal).not.toHaveBeenCalled();
    expect(push.sendToOrg).not.toHaveBeenCalled();
    expect(notifier.propostaDecidida).not.toHaveBeenCalled();
  });

  it("já REJECTED: lança ConflictError", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "REJECTED" })),
      },
    });

    await expect(service.accept(TOKEN, null)).rejects.toThrow(ConflictError);
    expect(proposals.decide).not.toHaveBeenCalled();
  });

  it("falha do createDraftFromProposal (ValidationError) não propaga -- aceite fica e notificação leva contractCreated: false", async () => {
    const { service, proposals, notifier } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })) },
      contracts: {
        createDraftFromProposal: vi
          .fn()
          .mockRejectedValue(new ValidationError("Empresa do lead não tem CPF/CNPJ cadastrado.")),
      },
    });

    const result = await service.accept(TOKEN, null);

    expect(result).toEqual({ status: "ACCEPTED" });
    expect(proposals.decide).toHaveBeenCalledTimes(1);
    expect((notifier.propostaDecidida as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        contractCreated: false,
        contractFailReason: "Empresa do lead não tem CPF/CNPJ cadastrado.",
      },
    );
  });

  it("erro genérico (não ValidationError) do createDraftFromProposal também é best-effort: aceite fica, atividade/push/e-mail rodam com contractCreated false", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { service, proposals, push, notifier, activityRepository } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })) },
      contracts: {
        createDraftFromProposal: vi.fn().mockRejectedValue(new Error("boom")),
      },
    });

    const result = await service.accept(TOKEN, null);

    expect(result).toEqual({ status: "ACCEPTED" });
    expect(proposals.decide).toHaveBeenCalledTimes(1);
    expect(activityRepository.record).toHaveBeenCalledTimes(1);
    expect((activityRepository.record as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        payload: {
          kind: "proposal_accepted_public",
          proposalId: PROPOSAL_ID,
          contractCreated: false,
        },
      },
    );
    expect(push.sendToOrg).toHaveBeenCalledTimes(1);
    expect((notifier.propostaDecidida as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        decision: "ACCEPTED",
        contractCreated: false,
        contractFailReason: "boom",
      },
    );
    consoleErrorSpy.mockRestore();
  });

  it("corrida: decide perde o CAS e a releitura mostra que outra requisição já aceitou -- responde idempotente", async () => {
    const { service, contracts } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })),
        decide: vi.fn().mockResolvedValue(null),
        findByIdForOrg: vi.fn().mockResolvedValue(fakeProposal({ status: "ACCEPTED" })),
      },
    });

    const result = await service.accept(TOKEN, null);

    expect(result).toEqual({ status: "ACCEPTED" });
    expect(contracts.createDraftFromProposal).not.toHaveBeenCalled();
  });

  it("corrida: decide perde o CAS e a releitura mostra REJECTED -- responde 409", async () => {
    const { service } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })),
        decide: vi.fn().mockResolvedValue(null),
        findByIdForOrg: vi.fn().mockResolvedValue(fakeProposal({ status: "REJECTED" })),
      },
    });

    await expect(service.accept(TOKEN, null)).rejects.toThrow(ConflictError);
  });
});

describe("ProposalPublicService.reject", () => {
  it("grava reason, muda status e não cria contrato", async () => {
    const { service, proposals, contracts, push, notifier } = makeService({
      proposals: { findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "SENT" })) },
    });

    const result = await service.reject(TOKEN, "5.6.7.8", "Muito caro");

    expect(result).toEqual({ status: "REJECTED" });
    expect(proposals.decide).toHaveBeenCalledWith(
      PROPOSAL_ID,
      "REJECTED",
      expect.objectContaining({ decisionIp: "5.6.7.8", rejectReason: "Muito caro" }),
    );
    expect(contracts.createDraftFromProposal).not.toHaveBeenCalled();
    expect(push.sendToOrg).toHaveBeenCalledTimes(1);
    expect((notifier.propostaDecidida as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject(
      {
        decision: "REJECTED",
        rejectReason: "Muito caro",
        contractCreated: false,
      },
    );
  });

  it("sem reason também funciona", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "VIEWED" })),
      },
    });

    const result = await service.reject(TOKEN, null);

    expect(result).toEqual({ status: "REJECTED" });
    expect(proposals.decide).toHaveBeenCalledWith(
      PROPOSAL_ID,
      "REJECTED",
      expect.objectContaining({ rejectReason: undefined }),
    );
  });

  it("já REJECTED: idempotente, retorna sem erro", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "REJECTED" })),
      },
    });

    const result = await service.reject(TOKEN, null);

    expect(result).toEqual({ status: "REJECTED" });
    expect(proposals.decide).not.toHaveBeenCalled();
  });

  it("já ACCEPTED: lança ConflictError", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi.fn().mockResolvedValue(fakeProposal({ status: "ACCEPTED" })),
      },
    });

    await expect(service.reject(TOKEN, null)).rejects.toThrow(ConflictError);
    expect(proposals.decide).not.toHaveBeenCalled();
  });

  it("expirada lança GoneError e marca EXPIRED", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByPublicToken: vi
          .fn()
          .mockResolvedValue(
            fakeProposal({ status: "VIEWED", validUntil: new Date("2020-01-01") }),
          ),
      },
    });

    await expect(service.reject(TOKEN, null)).rejects.toThrow(GoneError);
    expect(proposals.markExpired).toHaveBeenCalledWith(PROPOSAL_ID);
  });
});
