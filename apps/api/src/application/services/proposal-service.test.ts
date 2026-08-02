import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActivityRepository } from "../../domain/repositories/activity-repository.js";
import { ActivityLogger } from "./activity-logger.js";
import { env } from "../../config/env.js";
import { ConflictError, NotFoundError } from "../../domain/errors/app-error.js";
import type { LeadContact, LeadDetail } from "../../domain/entities/lead.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { Organization } from "../../domain/entities/organization.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { Proposal } from "../../domain/entities/proposal.js";
import type { ProposalRepository } from "../../domain/repositories/proposal-repository.js";
import type { ProposalNotifier } from "../../domain/services/proposal-notifier.js";
import { ProposalService } from "./proposal-service.js";

const ORG = "org-1";
const USER = "user-1";
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

function fakeContact(overrides: Partial<LeadContact> = {}): LeadContact {
  return {
    id: "contact-1",
    leadId: "lead-1",
    name: "Cliente Teste",
    role: null,
    email: "cliente@teste.com",
    phone: null,
    isPrimary: true,
    createdAt: new Date("2026-07-31"),
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
    contacts: [fakeContact()],
    notes: [],
    tags: [],
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

function makeService(
  overrides: {
    proposals?: Partial<ProposalRepository>;
    leads?: Partial<LeadRepository>;
    organizations?: Partial<OrganizationRepository>;
    notifier?: Partial<ProposalNotifier>;
  } = {},
) {
  const proposals = {
    create: vi.fn(),
    findByIdForOrg: vi.fn().mockResolvedValue(fakeProposal()),
    list: vi.fn(),
    update: vi.fn().mockImplementation(async (_id, _orgId, patch) =>
      fakeProposal({ status: patch.status ?? "DRAFT" }),
    ),
    // Fake CAS: comportamento default (sobrescrito nos testes de corrida/reenvio).
    ensurePublicToken: vi.fn().mockImplementation(async (_id, _orgId, token) => token),
    delete: vi.fn(),
    ...overrides.proposals,
  } as unknown as ProposalRepository;

  const leads = {
    findByIdForOrg: vi.fn().mockResolvedValue(fakeLead()),
    ...overrides.leads,
  } as unknown as LeadRepository;

  const organizations = {
    findById: vi.fn().mockResolvedValue(fakeOrganization()),
    ...overrides.organizations,
  } as unknown as OrganizationRepository;

  const activityRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    listForLead: vi.fn(),
    listRecentForOrg: vi.fn(),
  } as unknown as ActivityRepository;
  const activityLogger = new ActivityLogger(activityRepository);

  const notifier = {
    propostaEnviada: vi.fn().mockResolvedValue(undefined),
    ...overrides.notifier,
  } as unknown as ProposalNotifier;

  const service = new ProposalService(proposals, activityLogger, leads, organizations, notifier);

  return { service, proposals, leads, organizations, activityRepository, notifier };
}

describe("ProposalService.update", () => {
  const originalWebPublicUrl = env.WEB_PUBLIC_URL;

  afterEach(() => {
    env.WEB_PUBLIC_URL = originalWebPublicUrl;
  });

  it("transição pra SENT gera o publicToken via CAS e manda e-mail com o link", async () => {
    const { service, proposals, notifier } = makeService();

    await service.update(ORG, USER, PROPOSAL_ID, { status: "SENT" });

    expect(proposals.ensurePublicToken).toHaveBeenCalledTimes(1);
    // publicToken nunca deve ir no patch genérico -- só o CAS escreve nele.
    const patchArg = (proposals.update as ReturnType<typeof vi.fn>).mock.calls[0]![2];
    expect(patchArg.publicToken).toBeUndefined();

    expect(notifier.propostaEnviada).toHaveBeenCalledTimes(1);
    const emailArg = (notifier.propostaEnviada as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(emailArg.publicUrl).toMatch(/\/p\/.+/);
  });

  it("segunda transição SENT não regenera o token -- CAS devolve o já existente", async () => {
    const EXISTING_TOKEN = "EXISTINGTOKEN00000001";
    const { service, proposals, notifier } = makeService({
      proposals: {
        // Simula o CAS real: como publicToken já não é null, o updateMany
        // vira no-op e o findFirst devolve o token que já estava lá,
        // independente do token gerado localmente pra essa chamada.
        ensurePublicToken: vi.fn().mockResolvedValue(EXISTING_TOKEN),
      },
    });

    await service.update(ORG, USER, PROPOSAL_ID, { status: "SENT" });

    expect(proposals.ensurePublicToken).toHaveBeenCalledTimes(1);
    const emailArg = (notifier.propostaEnviada as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(emailArg.publicUrl).toBe(`${env.WEB_PUBLIC_URL}/p/${EXISTING_TOKEN}`);
  });

  it("corrida simulada: usa o token do vencedor devolvido pelo CAS, não o gerado localmente", async () => {
    const WINNER_TOKEN = "WINNERTOKEN0000000001";
    const { service, notifier } = makeService({
      proposals: {
        // O token que o service gera localmente (arg 3) é ignorado pelo
        // fake -- devolve sempre o do "vencedor" da corrida concorrente.
        ensurePublicToken: vi.fn().mockResolvedValue(WINNER_TOKEN),
      },
    });

    await service.update(ORG, USER, PROPOSAL_ID, { status: "SENT" });

    const emailArg = (notifier.propostaEnviada as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(emailArg.publicUrl).toBe(`${env.WEB_PUBLIC_URL}/p/${WINNER_TOKEN}`);
  });

  it("guarda: ACCEPTED manual sobre proposta já decidida pelo cliente lança ConflictError", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByIdForOrg: vi.fn().mockResolvedValue(
          fakeProposal({ decidedAt: new Date("2026-08-01") }),
        ),
      },
    });

    await expect(service.update(ORG, USER, PROPOSAL_ID, { status: "ACCEPTED" })).rejects.toThrow(
      ConflictError,
    );
    expect(proposals.update).not.toHaveBeenCalled();
  });

  it("guarda: REJECTED manual sobre proposta já decidida pelo cliente lança ConflictError", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByIdForOrg: vi.fn().mockResolvedValue(
          fakeProposal({ decidedAt: new Date("2026-08-01") }),
        ),
      },
    });

    await expect(service.update(ORG, USER, PROPOSAL_ID, { status: "REJECTED" })).rejects.toThrow(
      ConflictError,
    );
    expect(proposals.update).not.toHaveBeenCalled();
  });

  it("ACCEPTED manual com decidedAt ainda null passa normalmente", async () => {
    const { service, proposals } = makeService({
      proposals: {
        findByIdForOrg: vi.fn().mockResolvedValue(fakeProposal({ decidedAt: null })),
        update: vi.fn().mockResolvedValue(fakeProposal({ status: "ACCEPTED" })),
      },
    });

    const result = await service.update(ORG, USER, PROPOSAL_ID, { status: "ACCEPTED" });

    expect(result.status).toBe("ACCEPTED");
    expect(proposals.update).toHaveBeenCalledTimes(1);
  });

  it("propaga NotFoundError se a proposta não existir na checagem de guarda", async () => {
    const { service } = makeService({
      proposals: { findByIdForOrg: vi.fn().mockResolvedValue(null) },
    });

    await expect(service.update(ORG, USER, PROPOSAL_ID, { status: "ACCEPTED" })).rejects.toThrow(
      NotFoundError,
    );
  });

  it("publicUrl usa WEB_PUBLIC_URL sem barra final quando a env não tem barra", async () => {
    env.WEB_PUBLIC_URL = "https://millead.example.com";
    const TOKEN = "NOSLASHTOKEN00000001";
    const { service, notifier } = makeService({
      proposals: { ensurePublicToken: vi.fn().mockResolvedValue(TOKEN) },
    });

    await service.update(ORG, USER, PROPOSAL_ID, { status: "SENT" });

    const emailArg = (notifier.propostaEnviada as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(emailArg.publicUrl).toBe(`https://millead.example.com/p/${TOKEN}`);
  });

  it("publicUrl normaliza a barra final de WEB_PUBLIC_URL (sem virar //p/)", async () => {
    env.WEB_PUBLIC_URL = "https://millead.example.com/";
    const TOKEN = "TRAILINGSLASHTOKEN001";
    const { service, notifier } = makeService({
      proposals: { ensurePublicToken: vi.fn().mockResolvedValue(TOKEN) },
    });

    await service.update(ORG, USER, PROPOSAL_ID, { status: "SENT" });

    const emailArg = (notifier.propostaEnviada as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(emailArg.publicUrl).toBe(`https://millead.example.com/p/${TOKEN}`);
  });
});
