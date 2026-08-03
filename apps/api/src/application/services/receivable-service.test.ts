import { describe, expect, it, vi } from "vitest";
import type { ContractDetail } from "../../domain/entities/contract.js";
import type { Receivable } from "../../domain/entities/receivable.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { ReceivableRepository } from "../../domain/repositories/receivable-repository.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import { ReceivableService } from "./receivable-service.js";
import type { EstimateService } from "./estimate-service.js";

const ORG = "org-1";
const CONTRACT_ID = "contract-1";

function fakeContract(overrides: Partial<ContractDetail> = {}): ContractDetail {
  return {
    id: CONTRACT_ID,
    organizationId: ORG,
    companyId: "company-1",
    leadId: null,
    createdById: null,
    proposalId: null,
    numero: "MILWEB-2026-0001",
    tipo: "SITE",
    status: "ASSINADO",
    descricaoProjeto: "Site institucional",
    valorTotal: "1000.00",
    formaPagamento: "PARCELADO",
    percentualEntrada: "40",
    prazoEntregaDias: 30,
    limiteRevisoes: 2,
    contractorSnapshot: {},
    contractedSnapshot: {},
    provider: "MOCK",
    signatureDocId: null,
    signatureUrl: null,
    assinadoEm: new Date("2026-07-01"),
    hasPdfOriginal: true,
    hasPdfAssinado: true,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    signers: [],
    events: [],
    ...overrides,
  };
}

function fakeReceivable(overrides: Partial<Receivable> = {}): Receivable {
  return {
    id: "rec-1",
    organizationId: ORG,
    contractId: CONTRACT_ID,
    kind: "PARCELA",
    installmentIndex: 1,
    amount: "200.00",
    dueDate: new Date("2026-09-05"),
    paidAt: null,
    paidNote: null,
    ...overrides,
  };
}

function fakeRepos(overrides: {
  receivables?: Partial<ReceivableRepository>;
  contracts?: Partial<ContractRepository>;
  estimateService?: Partial<EstimateService>;
} = {}) {
  const receivables = {
    createPlan: vi.fn().mockResolvedValue([fakeReceivable()]),
    listByContract: vi.fn().mockResolvedValue([fakeReceivable()]),
    findById: vi.fn().mockResolvedValue(fakeReceivable()),
    markPaid: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-08-01") })),
    markUnpaid: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: null })),
    update: vi.fn().mockResolvedValue(fakeReceivable({ amount: "250.00" })),
    delete: vi.fn().mockResolvedValue(true),
    hasPaid: vi.fn().mockResolvedValue(false),
    deleteOpenByContract: vi.fn().mockResolvedValue(0),
    listForSummary: vi.fn().mockResolvedValue([]),
    sumPaidByContract: vi.fn().mockResolvedValue("0"),
    listContractsWithTotals: vi.fn().mockResolvedValue([]),
    ...overrides.receivables,
  } as unknown as ReceivableRepository;

  const contracts = {
    findByIdForOrg: vi.fn().mockResolvedValue(fakeContract()),
    ...overrides.contracts,
  } as unknown as ContractRepository;

  const estimateService = {
    projectedCostByProposalId: vi.fn().mockResolvedValue(null),
    ...overrides.estimateService,
  } as unknown as EstimateService;

  const service = new ReceivableService(receivables, contracts, estimateService);

  return { receivables, contracts, estimateService, service };
}

describe("ReceivableService.createPlan", () => {
  const VALID_INPUT = {
    contractId: CONTRACT_ID,
    total: 1000,
    entryAmount: 400,
    entryDueDate: new Date("2026-08-05"),
    installments: [
      { amount: 200, dueDate: new Date("2026-09-05") },
      { amount: 200, dueDate: new Date("2026-10-05") },
      { amount: 200, dueDate: new Date("2026-11-05") },
    ],
  };

  it("cria plano válido: entrada index 0, parcelas 1..N", async () => {
    const { service, receivables } = fakeRepos();
    await service.createPlan(ORG, VALID_INPUT);

    expect(receivables.createPlan).toHaveBeenCalledWith(
      ORG,
      CONTRACT_ID,
      expect.arrayContaining([
        expect.objectContaining({ kind: "ENTRADA", installmentIndex: 0, amount: "400.00" }),
        expect.objectContaining({ kind: "PARCELA", installmentIndex: 1, amount: "200.00" }),
        expect.objectContaining({ kind: "PARCELA", installmentIndex: 2, amount: "200.00" }),
        expect.objectContaining({ kind: "PARCELA", installmentIndex: 3, amount: "200.00" }),
      ]),
    );
    const items = vi.mocked(receivables.createPlan).mock.calls[0]![2] as Array<{ installmentIndex: number }>;
    expect(items).toHaveLength(4);
  });

  it("sem entrada (entryAmount 0) não gera item ENTRADA", async () => {
    const { service, receivables } = fakeRepos();
    await service.createPlan(ORG, {
      ...VALID_INPUT,
      entryAmount: 0,
      installments: [
        { amount: 500, dueDate: new Date("2026-09-05") },
        { amount: 500, dueDate: new Date("2026-10-05") },
      ],
    });
    const items = vi.mocked(receivables.createPlan).mock.calls[0]![2] as Array<{ kind: string }>;
    expect(items.every((i) => i.kind === "PARCELA")).toBe(true);
    expect(items).toHaveLength(2);
  });

  it("soma diferente do total -> ValidationError com a diferença na mensagem", async () => {
    const { service, receivables } = fakeRepos();
    await expect(
      service.createPlan(ORG, {
        ...VALID_INPUT,
        installments: [{ amount: 200, dueDate: new Date("2026-09-05") }],
      }),
    ).rejects.toThrow(ValidationError);
    expect(receivables.createPlan).not.toHaveBeenCalled();

    try {
      await service.createPlan(ORG, {
        ...VALID_INPUT,
        installments: [{ amount: 200, dueDate: new Date("2026-09-05") }],
      });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain("400.00");
    }
  });

  it("tolera diferença de até 0.01 (arredondamento)", async () => {
    const { service, receivables } = fakeRepos();
    await service.createPlan(ORG, {
      ...VALID_INPUT,
      total: 1000.01,
      installments: [
        { amount: 200, dueDate: new Date("2026-09-05") },
        { amount: 200, dueDate: new Date("2026-10-05") },
        { amount: 200, dueDate: new Date("2026-11-05") },
      ],
    });
    expect(receivables.createPlan).toHaveBeenCalled();
  });

  it("contrato de outra org -> NotFoundError", async () => {
    const { service, receivables } = fakeRepos({
      contracts: { findByIdForOrg: vi.fn().mockResolvedValue(null) },
    });
    await expect(service.createPlan(ORG, VALID_INPUT)).rejects.toThrow(NotFoundError);
    expect(receivables.createPlan).not.toHaveBeenCalled();
  });

  it("contrato já tem parcela paga -> ConflictError, sem deletar nem recriar", async () => {
    const { service, receivables } = fakeRepos({
      receivables: { hasPaid: vi.fn().mockResolvedValue(true) },
    });
    await expect(service.createPlan(ORG, VALID_INPUT)).rejects.toThrow(ConflictError);
    expect(receivables.deleteOpenByContract).not.toHaveBeenCalled();
    expect(receivables.createPlan).not.toHaveBeenCalled();
  });

  it("recriar sem parcela paga: chama deleteOpenByContract antes de criar o novo plano", async () => {
    const { service, receivables } = fakeRepos({
      receivables: { hasPaid: vi.fn().mockResolvedValue(false) },
    });
    await service.createPlan(ORG, VALID_INPUT);
    expect(receivables.deleteOpenByContract).toHaveBeenCalledWith(ORG, CONTRACT_ID);
    expect(receivables.createPlan).toHaveBeenCalled();
  });
});

describe("ReceivableService.pay/unpay", () => {
  it("pay marca paga com sucesso", async () => {
    const { service, receivables } = fakeRepos();
    const result = await service.pay(ORG, "rec-1", {});
    expect(result.paidAt).not.toBeNull();
    expect(receivables.markPaid).toHaveBeenCalled();
  });

  it("pay em parcela já paga -> ConflictError", async () => {
    const { service } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })),
        markPaid: vi.fn().mockResolvedValue(null),
      },
    });
    await expect(service.pay(ORG, "rec-1", {})).rejects.toThrow(ConflictError);
  });

  it("pay em parcela inexistente -> NotFoundError", async () => {
    const { service } = fakeRepos({ receivables: { findById: vi.fn().mockResolvedValue(null) } });
    await expect(service.pay(ORG, "rec-x", {})).rejects.toThrow(NotFoundError);
  });

  it("unpay desfaz baixa com sucesso", async () => {
    const { service, receivables } = fakeRepos({
      receivables: { findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })) },
    });
    const result = await service.unpay(ORG, "rec-1");
    expect(result.paidAt).toBeNull();
    expect(receivables.markUnpaid).toHaveBeenCalled();
  });

  it("unpay em parcela não paga -> ConflictError", async () => {
    const { service } = fakeRepos({ receivables: { findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: null })) } });
    await expect(service.unpay(ORG, "rec-1")).rejects.toThrow(ConflictError);
  });
});

describe("ReceivableService.update/remove", () => {
  it("update em parcela aberta funciona", async () => {
    const { service, receivables } = fakeRepos();
    await service.update(ORG, "rec-1", { amount: 250 });
    expect(receivables.update).toHaveBeenCalledWith(ORG, "rec-1", expect.objectContaining({ amount: "250.00" }));
  });

  it("update em parcela paga -> ConflictError", async () => {
    const { service, receivables } = fakeRepos({
      receivables: { findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })) },
    });
    await expect(service.update(ORG, "rec-1", { amount: 250 })).rejects.toThrow(ConflictError);
    expect(receivables.update).not.toHaveBeenCalled();
  });

  it("remove em parcela aberta funciona", async () => {
    const { service, receivables } = fakeRepos();
    await service.remove(ORG, "rec-1");
    expect(receivables.delete).toHaveBeenCalledWith(ORG, "rec-1");
  });

  it("remove em parcela paga -> ConflictError", async () => {
    const { service, receivables } = fakeRepos({
      receivables: { findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })) },
    });
    await expect(service.remove(ORG, "rec-1")).rejects.toThrow(ConflictError);
    expect(receivables.delete).not.toHaveBeenCalled();
  });
});

describe("ReceivableService.summary", () => {
  it("separa em aberto no mês, vencida antiga (qualquer data passada) e paga no mês", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const openThisMonth = fakeReceivable({
      id: "rec-open",
      amount: "300.00",
      dueDate: new Date("2026-08-20"),
      paidAt: null,
    });
    const overdueOld = fakeReceivable({
      id: "rec-overdue",
      amount: "150.00",
      dueDate: new Date("2026-06-01"),
      paidAt: null,
    });
    const paidThisMonth = fakeReceivable({
      id: "rec-paid",
      amount: "400.00",
      dueDate: new Date("2026-08-10"),
      paidAt: new Date("2026-08-10"),
    });

    const { service, receivables } = fakeRepos({
      receivables: {
        listForSummary: vi.fn().mockResolvedValue([openThisMonth, overdueOld, paidThisMonth]),
      },
    });

    const result = await service.summary(ORG, "2026-08");

    expect(result.month).toBe("2026-08");
    expect(result.toReceive).toBe("300.00");
    expect(result.overdue).toBe("150.00");
    expect(result.overdueItems).toEqual([overdueOld]);
    expect(result.received).toBe("400.00");
    expect(receivables.listForSummary).toHaveBeenCalledWith(
      ORG,
      new Date(Date.UTC(2026, 7, 1)),
      new Date(Date.UTC(2026, 8, 1)),
    );

    vi.useRealTimers();
  });

  it("parcela vencida fora do mês consultado mas paga dentro dele cai em 'received' (não em toReceive/overdue)", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Vencida em junho (fora do mês consultado), paga em agosto.
    const paidLateOutsideMonth = fakeReceivable({
      id: "rec-paid-late",
      amount: "250.00",
      dueDate: new Date("2026-06-10"),
      paidAt: new Date("2026-08-12"),
    });

    const { service } = fakeRepos({
      receivables: {
        listForSummary: vi.fn().mockResolvedValue([paidLateOutsideMonth]),
      },
    });

    const result = await service.summary(ORG, "2026-08");

    expect(result.received).toBe("250.00");
    expect(result.toReceive).toBe("0.00");
    expect(result.overdue).toBe("0.00");
    expect(result.overdueItems).toEqual([]);

    vi.useRealTimers();
  });

  it("sem month explícito usa o mês atual (America/Sao_Paulo)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const { service, receivables } = fakeRepos();
    const result = await service.summary(ORG);

    expect(result.month).toBe("2026-08");
    expect(receivables.listForSummary).toHaveBeenCalledWith(
      ORG,
      new Date(Date.UTC(2026, 7, 1)),
      new Date(Date.UTC(2026, 8, 1)),
    );

    vi.useRealTimers();
  });
});

describe("ReceivableService.margin", () => {
  it("com orçamento vinculado: projectedCost e realizedMargin calculados", async () => {
    const { service, contracts, estimateService } = fakeRepos({
      contracts: {
        findByIdForOrg: vi.fn().mockResolvedValue(fakeContract({ proposalId: "proposal-1", valorTotal: "1000.00" })),
      },
      receivables: { sumPaidByContract: vi.fn().mockResolvedValue("600.00") },
      estimateService: { projectedCostByProposalId: vi.fn().mockResolvedValue(400) },
    });

    const result = await service.margin(ORG, CONTRACT_ID);

    expect(contracts.findByIdForOrg).toHaveBeenCalledWith(CONTRACT_ID, ORG);
    expect(estimateService.projectedCostByProposalId).toHaveBeenCalledWith(ORG, "proposal-1");
    expect(result).toEqual({
      contractId: CONTRACT_ID,
      soldValue: "1000.00",
      received: "600.00",
      projectedCost: "400.00",
      realizedMargin: "200.00",
    });
  });

  it("sem proposalId: projectedCost e realizedMargin null", async () => {
    const { service, estimateService } = fakeRepos({
      contracts: { findByIdForOrg: vi.fn().mockResolvedValue(fakeContract({ proposalId: null })) },
      receivables: { sumPaidByContract: vi.fn().mockResolvedValue("600.00") },
    });

    const result = await service.margin(ORG, CONTRACT_ID);

    expect(estimateService.projectedCostByProposalId).not.toHaveBeenCalled();
    expect(result.projectedCost).toBeNull();
    expect(result.realizedMargin).toBeNull();
  });

  it("contrato de outra org -> NotFoundError", async () => {
    const { service } = fakeRepos({ contracts: { findByIdForOrg: vi.fn().mockResolvedValue(null) } });
    await expect(service.margin(ORG, CONTRACT_ID)).rejects.toThrow(NotFoundError);
  });
});
