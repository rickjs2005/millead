import { describe, expect, it, vi } from "vitest";
import type { Contract } from "../../domain/entities/contract.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { ContractNotifier } from "../../domain/services/contract-notifier.js";
import type { ContractQueue } from "../../domain/services/contract-queue.js";
import type { ContractSignatureGateway } from "../../domain/services/contract-signature.js";
import { ContractService } from "./contract-service.js";
import type { PostSaleOnboardingService } from "./post-sale-onboarding-service.js";

const ORG = "org-1";
const DOC_ID = "doc-abc";

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
    status: "AGUARDANDO_ASSINATURA",
    descricaoProjeto: "Site institucional",
    valorTotal: "5000.00",
    formaPagamento: "PIX",
    percentualEntrada: "50.00",
    prazoEntregaDias: 30,
    limiteRevisoes: 2,
    contractorSnapshot: {
      tipoPessoa: "PJ",
      nome: "Cliente",
      documento: "12345678000199",
      email: "cliente@teste.com",
      telefone: "31999999999",
      endereco: "Rua X",
      nomeEmpresa: "Cliente LTDA",
    },
    contractedSnapshot: {},
    provider: "MOCK",
    signatureDocId: DOC_ID,
    signatureUrl: null,
    assinadoEm: null,
    hasPdfOriginal: true,
    hasPdfAssinado: false,
    falhouProcessamento: false,
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date("2026-08-01"),
    ...overrides,
  };
}

interface Options {
  contract?: Contract;
  postSale?: PostSaleOnboardingService | undefined;
}

function makeService(options: Options = {}) {
  const contract = options.contract ?? fakeContract();
  const markSigned = vi.fn(async () => ({ ...contract, status: "ASSINADO" as const }));
  const addEvent = vi.fn(async () => undefined);

  const contracts = {
    findBySignatureDocId: vi.fn(async () => contract),
    markSigned,
    addEvent,
  } as unknown as ContractRepository;

  const gateway = {
    nome: "MOCK",
    verificarAssinatura: vi.fn(() => true),
    interpretarWebhook: vi.fn(() => ({ evento: "ASSINADO", docId: DOC_ID, raw: {} })),
    confirmarAssinado: vi.fn(async () => ({ assinado: true, assinadoEm: null, pdfAssinadoUrl: null })),
  } as unknown as ContractSignatureGateway;

  const notifier = { contratoAssinado: vi.fn(async () => undefined) } as unknown as ContractNotifier;

  const service = new ContractService(
    contracts,
    {} as CompanyRepository,
    {} as OrganizationRepository,
    {} as ContractQueue,
    gateway,
    notifier,
    options.postSale,
  );

  return { service, markSigned, addEvent, notifier };
}

describe("17. webhook de assinatura — nenhuma regressão no fluxo atual", () => {
  it("marca ASSINADO e grava o evento mesmo SEM automação injetada", async () => {
    const { service, markSigned, addEvent } = makeService({ postSale: undefined });

    await expect(service.handleSignatureWebhook({}, "{}", {})).resolves.toEqual({ ok: true });

    expect(markSigned).toHaveBeenCalledTimes(1);
    expect(addEvent).toHaveBeenCalledWith("contract-1", ORG, "ASSINADO", "WEBHOOK");
  });

  it("contrato já ASSINADO continua sendo no-op idempotente", async () => {
    const { service, markSigned } = makeService({
      contract: fakeContract({ status: "ASSINADO" }),
    });

    await expect(service.handleSignatureWebhook({}, "{}", {})).resolves.toEqual({ ok: true });

    expect(markSigned).not.toHaveBeenCalled();
  });
});

describe("16. a assinatura nunca é perdida por falha da automação", () => {
  it("a automação só é chamada DEPOIS de markSigned", async () => {
    const order: string[] = [];
    const postSale = {
      trigger: vi.fn(async () => {
        order.push("trigger");
        return null;
      }),
    } as unknown as PostSaleOnboardingService;
    const { service, markSigned } = makeService({ postSale });
    markSigned.mockImplementation(async () => {
      order.push("markSigned");
      return { ...fakeContract(), status: "ASSINADO" as const };
    });

    await service.handleSignatureWebhook({}, "{}", {});

    expect(order).toEqual(["markSigned", "trigger"]);
  });

  it("trigger que explode NÃO derruba o webhook nem impede a notificação", async () => {
    // `trigger` já é best-effort por dentro. Este teste cobre a rede DE FORA:
    // mesmo que ele passe a lançar um dia, o webhook responde 200, a
    // assinatura fica registrada e o cliente é notificado do mesmo jeito.
    const postSale = {
      trigger: vi.fn(async () => {
        throw new Error("automação quebrada");
      }),
    } as unknown as PostSaleOnboardingService;
    const { service, markSigned, notifier } = makeService({ postSale });

    await expect(service.handleSignatureWebhook({}, "{}", {})).resolves.toEqual({ ok: true });

    expect(markSigned).toHaveBeenCalledTimes(1);
    expect(notifier.contratoAssinado).toHaveBeenCalledTimes(1);
  });
});
