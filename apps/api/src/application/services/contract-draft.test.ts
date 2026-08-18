import { describe, expect, it, vi } from "vitest";
import type { Contract } from "../../domain/entities/contract.js";
import { ValidationError } from "../../domain/errors/app-error.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { Organization } from "../../domain/entities/organization.js";
import type { Proposal } from "../../domain/entities/proposal.js";
import type { ContractNotifier } from "../../domain/services/contract-notifier.js";
import type { ContractQueue } from "../../domain/services/contract-queue.js";
import type { ContractSignatureGateway } from "../../domain/services/contract-signature.js";
import { ContractService, type DraftFromProposalInput } from "./contract-service.js";

const ORG = "org-1";
const PROPOSAL_ID = "cproposal000123456";

function fakeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: PROPOSAL_ID,
    organizationId: ORG,
    leadId: "lead-1",
    createdById: "user-1",
    title: "Site institucional",
    status: "ACCEPTED",
    value: "5000.00",
    currency: "BRL",
    validUntil: new Date("2026-08-15"),
    pdfUrl: null,
    sentAt: new Date("2026-07-30"),
    respondedAt: new Date("2026-08-01"),
    publicToken: "TOKEN0000000000000001",
    viewedAt: new Date("2026-08-01"),
    decidedAt: new Date("2026-08-01"),
    decisionIp: "1.2.3.4",
    rejectReason: null,
    createdAt: new Date("2026-07-31"),
    updatedAt: new Date("2026-08-01"),
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

function fakeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "contract-1",
    organizationId: ORG,
    companyId: "company-1",
    leadId: "lead-1",
    createdById: null,
    proposalId: null,
    numero: "MILWEB-2026-000001",
    tipo: "SITE",
    status: "RASCUNHO",
    descricaoProjeto: "Site institucional",
    valorTotal: "5000.00",
    formaPagamento: "PIX",
    percentualEntrada: "50.00",
    prazoEntregaDias: 30,
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
    contracts?: Partial<ContractRepository>;
    companies?: Partial<CompanyRepository>;
    organizations?: Partial<OrganizationRepository>;
  } = {},
) {
  const contracts = {
    create: vi.fn().mockImplementation(async () => fakeContract()),
    findByProposalId: vi.fn().mockResolvedValue(null),
    findByIdForOrg: vi.fn(),
    findBySignatureDocId: vi.fn(),
    list: vi.fn(),
    kpis: vi.fn(),
    updateStatus: vi.fn(),
    savePdfOriginal: vi.fn(),
    setSignatureDoc: vi.fn(),
    markSigned: vi.fn(),
    addEvent: vi.fn(),
    getPdf: vi.fn(),
    ...overrides.contracts,
  } as unknown as ContractRepository;

  const companies = {
    findByDocumentForOrg: vi.fn(),
    create: vi.fn(),
    ...overrides.companies,
  } as unknown as CompanyRepository;

  const organizations = {
    findById: vi.fn().mockResolvedValue(fakeOrganization()),
    findBySlug: vi.fn(),
    ...overrides.organizations,
  } as unknown as OrganizationRepository;

  const queue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContractQueue;

  const gateway = {
    nome: "MOCK",
    criarDocumento: vi.fn(),
    verificarAssinatura: vi.fn(),
    interpretarWebhook: vi.fn(),
    confirmarAssinado: vi.fn(),
  } as unknown as ContractSignatureGateway;

  const notifier = {
    conviteAssinatura: vi.fn().mockResolvedValue(undefined),
    contratoAssinado: vi.fn().mockResolvedValue(undefined),
  } as unknown as ContractNotifier;

  const service = new ContractService(
    contracts,
    companies,
    organizations,
    queue,
    gateway,
    notifier,
  );

  return { service, contracts, companies, organizations, queue, gateway, notifier };
}

function fakeInput(overrides: Partial<DraftFromProposalInput> = {}): DraftFromProposalInput {
  return {
    proposal: fakeProposal(),
    estimate: {
      scopeItems: ["Página inicial", "Página de contato"],
      deadlineDays: 21,
    },
    company: {
      id: "company-1",
      name: "Cliente LTDA",
      document: "12.345.678/0001-99",
      email: "contato@cliente.com",
      phone: "31999999999",
    },
    contact: {
      name: "Fulano de Tal",
      email: "fulano@cliente.com",
      phone: "31988888888",
    },
    ...overrides,
  };
}

describe("ContractService.createDraftFromProposal", () => {
  it("cria contrato RASCUNHO herdado da proposta, sem enfileirar", async () => {
    const { service, contracts, queue } = makeService();

    const result = await service.createDraftFromProposal(fakeInput());

    expect(contracts.create).toHaveBeenCalledTimes(1);
    const arg = (contracts.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];

    expect(arg.proposalId).toBe(PROPOSAL_ID);
    expect(arg.companyId).toBe("company-1");
    expect(arg.organizationId).toBe(ORG);
    expect(arg.leadId).toBe("lead-1");
    expect(arg.createdById).toBeNull();
    expect(arg.valorTotal).toBe("5000.00");
    expect(arg.descricaoProjeto).toBe("Site institucional\n- Página inicial\n- Página de contato");
    expect(arg.prazoEntregaDias).toBe(21);
    expect(arg.tipo).toBe("SITE");
    expect(arg.formaPagamento).toBe("PIX");
    expect(arg.percentualEntrada).toBe("50.00");
    expect(arg.limiteRevisoes).toBe(2);
    expect(arg.origem).toBe("APP");
    expect(arg.contractorSnapshot).toEqual({
      tipoPessoa: "PJ",
      nome: "Fulano de Tal",
      documento: "12345678000199",
      email: "fulano@cliente.com",
      telefone: "31988888888",
      endereco: "",
      nomeEmpresa: "Cliente LTDA",
    });

    expect(result).toEqual(fakeContract());
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("sem empresa vinculada lança ValidationError e não cria contrato", async () => {
    const { service, contracts } = makeService();

    await expect(service.createDraftFromProposal(fakeInput({ company: null }))).rejects.toThrow(
      ValidationError,
    );
    expect(contracts.create).not.toHaveBeenCalled();
  });

  it("empresa sem documento cadastrado lança ValidationError", async () => {
    const { service, contracts } = makeService();

    await expect(
      service.createDraftFromProposal(
        fakeInput({
          company: {
            id: "company-1",
            name: "Cliente LTDA",
            document: null,
            email: null,
            phone: null,
          },
        }),
      ),
    ).rejects.toThrow(ValidationError);
    expect(contracts.create).not.toHaveBeenCalled();
  });

  it("proposta que já tem contrato retorna o existente sem criar de novo (idempotência)", async () => {
    const existing = fakeContract({ id: "already-there" });
    const { service, contracts, queue } = makeService({
      contracts: { findByProposalId: vi.fn().mockResolvedValue(existing) },
    });

    const result = await service.createDraftFromProposal(fakeInput());

    expect(result).toEqual(existing);
    expect(contracts.create).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("estimate null usa só o título da proposta e prazo padrão de 30 dias", async () => {
    const { service, contracts } = makeService();

    await service.createDraftFromProposal(fakeInput({ estimate: null }));

    const arg = (contracts.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(arg.descricaoProjeto).toBe("Site institucional");
    expect(arg.prazoEntregaDias).toBe(30);
  });

  it("sem contato principal cai pro nome/email/telefone da empresa", async () => {
    const { service, contracts } = makeService();

    await service.createDraftFromProposal(fakeInput({ contact: null }));

    const arg = (contracts.create as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(arg.contractorSnapshot).toMatchObject({
      nome: "Cliente LTDA",
      email: "contato@cliente.com",
      telefone: "31999999999",
    });
  });
});
