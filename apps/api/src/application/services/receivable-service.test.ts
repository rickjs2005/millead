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
    description: null,
    kind: "PARCELA",
    installmentIndex: 1,
    amount: "200.00",
    dueDate: new Date("2026-09-05"),
    paidAt: null,
    paidNote: null,
    ...overrides,
  };
}

function fakeRepos(
  overrides: {
    receivables?: Partial<ReceivableRepository>;
    contracts?: Partial<ContractRepository>;
    estimateService?: Partial<EstimateService>;
  } = {},
) {
  const receivables = {
    createPlan: vi.fn().mockResolvedValue([fakeReceivable()]),
    createStandalone: vi.fn().mockResolvedValue(
      fakeReceivable({
        id: "rec-avulsa",
        contractId: null,
        description: "Consultoria avulsa",
        kind: "AVULSA",
        installmentIndex: 0,
      }),
    ),
    listStandalone: vi.fn().mockResolvedValue([]),
    listByContract: vi.fn().mockResolvedValue([fakeReceivable()]),
    findById: vi.fn().mockResolvedValue(fakeReceivable()),
    markPaid: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-08-01") })),
    markUnpaid: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: null })),
    update: vi.fn().mockResolvedValue(fakeReceivable({ amount: "250.00" })),
    delete: vi.fn().mockResolvedValue(true),
    hasPaid: vi.fn().mockResolvedValue(false),
    deleteOpenByContract: vi.fn().mockResolvedValue(0),
    listForSummary: vi.fn().mockResolvedValue([]),
    listForSeries: vi.fn().mockResolvedValue([]),
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
    const items = vi.mocked(receivables.createPlan).mock.calls[0]![2] as Array<{
      installmentIndex: number;
    }>;
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

  it("total do plano diferente do valor do contrato -> ValidationError, mesmo com soma interna consistente", async () => {
    const { service, receivables } = fakeRepos();
    await expect(
      service.createPlan(ORG, {
        ...VALID_INPUT,
        total: 500,
        entryAmount: 200,
        installments: [
          { amount: 100, dueDate: new Date("2026-09-05") },
          { amount: 100, dueDate: new Date("2026-10-05") },
          { amount: 100, dueDate: new Date("2026-11-05") },
        ],
      }),
    ).rejects.toThrow(ValidationError);
    expect(receivables.createPlan).not.toHaveBeenCalled();

    try {
      await service.createPlan(ORG, {
        ...VALID_INPUT,
        total: 500,
        entryAmount: 200,
        installments: [
          { amount: 100, dueDate: new Date("2026-09-05") },
          { amount: 100, dueDate: new Date("2026-10-05") },
          { amount: 100, dueDate: new Date("2026-11-05") },
        ],
      });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain("1000.00");
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

describe("ReceivableService.createStandalone", () => {
  it("sem alreadyPaid: cria com paidAt null, contractId não entra no payload (repositório fixa null+installmentIndex 0)", async () => {
    const { service, receivables } = fakeRepos();

    await service.createStandalone(ORG, {
      amount: 1500,
      description: "Consultoria avulsa pro Rick",
      dueDate: new Date("2026-09-10"),
    });

    expect(receivables.createStandalone).toHaveBeenCalledWith(ORG, {
      description: "Consultoria avulsa pro Rick",
      amount: "1500.00",
      dueDate: new Date("2026-09-10"),
      paidAt: null,
    });
  });

  it("com alreadyPaid: paidAt = new Date() (timestamp real, regime de caixa) -- não usa a dueDate nem aceita data do cliente", async () => {
    const now = new Date("2026-08-09T14:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { service, receivables } = fakeRepos();
    await service.createStandalone(ORG, {
      amount: 1500,
      description: "Recebido em mãos",
      dueDate: new Date("2026-07-01"), // data de vencimento, propositalmente diferente de "agora"
      alreadyPaid: true,
    });

    expect(receivables.createStandalone).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ paidAt: now }),
    );

    vi.useRealTimers();
  });

  it("alreadyPaid false explícito: paidAt continua null", async () => {
    const { service, receivables } = fakeRepos();
    await service.createStandalone(ORG, {
      amount: 100,
      description: "Teste",
      dueDate: new Date("2026-09-10"),
      alreadyPaid: false,
    });
    expect(receivables.createStandalone).toHaveBeenCalledWith(
      ORG,
      expect.objectContaining({ paidAt: null }),
    );
  });

  it("retorna a avulsa criada (kind AVULSA, contractId null, installmentIndex 0)", async () => {
    const { service } = fakeRepos();
    const result = await service.createStandalone(ORG, {
      amount: 1500,
      description: "Consultoria",
      dueDate: new Date("2026-09-10"),
    });
    expect(result.kind).toBe("AVULSA");
    expect(result.contractId).toBeNull();
    expect(result.installmentIndex).toBe(0);
  });
});

describe("ReceivableService.listStandalone", () => {
  it("delega ao repositório passando a org", async () => {
    const { service, receivables } = fakeRepos({
      receivables: {
        listStandalone: vi
          .fn()
          .mockResolvedValue([
            fakeReceivable({ id: "rec-a", contractId: null, kind: "AVULSA", description: "A" }),
          ]),
      },
    });
    const result = await service.listStandalone(ORG);
    expect(receivables.listStandalone).toHaveBeenCalledWith(ORG);
    expect(result).toHaveLength(1);
    expect(result[0]!.kind).toBe("AVULSA");
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
      receivables: {
        findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })),
      },
    });
    const result = await service.unpay(ORG, "rec-1");
    expect(result.paidAt).toBeNull();
    expect(receivables.markUnpaid).toHaveBeenCalled();
  });

  it("unpay em parcela não paga -> ConflictError", async () => {
    const { service } = fakeRepos({
      receivables: { findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: null })) },
    });
    await expect(service.unpay(ORG, "rec-1")).rejects.toThrow(ConflictError);
  });

  it("pay funciona em avulsa (contractId null) -- nenhuma checagem de contrato bloqueia o fluxo", async () => {
    const avulsaAberta = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
      description: "Consultoria avulsa",
    });
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(avulsaAberta),
        markPaid: vi.fn().mockResolvedValue({ ...avulsaAberta, paidAt: new Date("2026-08-09") }),
      },
    });
    const result = await service.pay(ORG, "rec-avulsa", {});
    expect(result.paidAt).not.toBeNull();
    expect(receivables.markPaid).toHaveBeenCalledWith(ORG, "rec-avulsa", expect.any(Date), null);
  });

  it("unpay funciona em avulsa paga (contractId null)", async () => {
    const avulsaPaga = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
      paidAt: new Date("2026-08-01"),
    });
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(avulsaPaga),
        markUnpaid: vi.fn().mockResolvedValue({ ...avulsaPaga, paidAt: null }),
      },
    });
    const result = await service.unpay(ORG, "rec-avulsa");
    expect(result.paidAt).toBeNull();
    expect(receivables.markUnpaid).toHaveBeenCalledWith(ORG, "rec-avulsa");
  });
});

describe("ReceivableService.update/remove", () => {
  // Fixture-base pros testes de invariante: parcela única do contrato,
  // valor bate exatamente com o valorTotal (200.00) -- espelha o estado que
  // createPlan garante na criação (soma == contract.valorTotal).
  function singleInstallmentContractRepos(overrides: Parameters<typeof fakeRepos>[0] = {}) {
    return fakeRepos({
      ...overrides,
      contracts: {
        findByIdForOrg: vi.fn().mockResolvedValue(fakeContract({ valorTotal: "200.00" })),
        ...overrides.contracts,
      },
      receivables: {
        listByContract: vi.fn().mockResolvedValue([fakeReceivable({ amount: "200.00" })]),
        ...overrides.receivables,
      },
    });
  }

  it("update em parcela aberta que MANTÉM a soma do contrato (idempotente: mesmo valor) funciona", async () => {
    const { service, receivables } = singleInstallmentContractRepos();
    await service.update(ORG, "rec-1", { amount: 200 });
    expect(receivables.update).toHaveBeenCalledWith(
      ORG,
      "rec-1",
      expect.objectContaining({ amount: "200.00" }),
    );
  });

  it("update de amount que QUEBRA a soma do contrato -> ValidationError citando os dois valores", async () => {
    const { service, receivables } = singleInstallmentContractRepos();
    await expect(service.update(ORG, "rec-1", { amount: 500 })).rejects.toThrow(ValidationError);
    expect(receivables.update).not.toHaveBeenCalled();

    try {
      await service.update(ORG, "rec-1", { amount: 500 });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain("500.00");
      expect((error as Error).message).toContain("200.00");
    }
  });

  it("update de amount considera parcelas PAGAS pelo valor histórico + as demais abertas ao recalcular a soma", async () => {
    // Contrato de 1000: uma entrada PAGA de 400 (valor histórico, não muda)
    // + parcela aberta rec-2 de 300 (não editada, entra como está) + rec-1
    // (parcela editada). Soma hipotética válida: 400 + 300 + 300 = 1000.
    const { service, receivables } = fakeRepos({
      contracts: {
        findByIdForOrg: vi.fn().mockResolvedValue(fakeContract({ valorTotal: "1000.00" })),
      },
      receivables: {
        listByContract: vi.fn().mockResolvedValue([
          fakeReceivable({
            id: "rec-entrada",
            kind: "ENTRADA",
            installmentIndex: 0,
            amount: "400.00",
            paidAt: new Date("2026-07-01"),
          }),
          fakeReceivable({ id: "rec-2", installmentIndex: 2, amount: "300.00" }),
          fakeReceivable({ id: "rec-1", installmentIndex: 1, amount: "200.00" }),
        ]),
      },
    });
    await service.update(ORG, "rec-1", { amount: 300 });
    expect(receivables.update).toHaveBeenCalledWith(
      ORG,
      "rec-1",
      expect.objectContaining({ amount: "300.00" }),
    );
  });

  it("update de amount numa AVULSA (contractId null) NUNCA bloqueia por divergência de total -- não há contrato pra bater", async () => {
    const avulsaAberta = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
      amount: "200.00",
    });
    const { service, receivables, contracts } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(avulsaAberta),
        update: vi.fn().mockResolvedValue({ ...avulsaAberta, amount: "99999.00" }),
      },
    });
    await service.update(ORG, "rec-avulsa", { amount: 99999 });
    expect(receivables.update).toHaveBeenCalledWith(
      ORG,
      "rec-avulsa",
      expect.objectContaining({ amount: "99999.00" }),
    );
    // Nem chega a olhar pro contrato -- confirma que a checagem é pulada de
    // verdade, não só "por acaso bateu".
    expect(contracts.findByIdForOrg).not.toHaveBeenCalled();
  });

  it("update em parcela paga -> ConflictError (regressão: bloqueio pré-existente continua valendo, não é a checagem de soma nova)", async () => {
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })),
      },
    });
    await expect(service.update(ORG, "rec-1", { amount: 250 })).rejects.toThrow(ConflictError);
    expect(receivables.update).not.toHaveBeenCalled();
  });

  // Não existe um "remove de parcela de contrato que MANTÉM a soma" realista:
  // toda parcela criada por createPlan tem amount > 0 (money.positive()), e
  // o invariante da criação garante soma == valorTotal. Remover qualquer
  // parcela aberta subtrai um valor positivo dessa soma já batida -- o único
  // jeito de "sobrar batido" seria remover uma parcela de valor zero (não
  // criável) ou o contrato ter valorTotal 0 (borda inexistente na prática).
  // Por isso o caso feliz de remove() só existe pra AVULSA (testado abaixo,
  // "remove funciona em avulsa aberta") -- pra contrato, remove SEMPRE
  // diverge e o teste abaixo cobre exatamente isso.
  it("remove de parcela aberta de contrato deixa a soma divergente -> ValidationError citando os dois valores", async () => {
    const { service, receivables } = fakeRepos(); // fixture default: 1 parcela de 200.00, contrato de 1000.00
    await expect(service.remove(ORG, "rec-1")).rejects.toThrow(ValidationError);
    expect(receivables.delete).not.toHaveBeenCalled();

    try {
      await service.remove(ORG, "rec-1");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toContain("0.00");
      expect((error as Error).message).toContain("1000.00");
    }
  });

  it("remove de parcela aberta de AVULSA nunca é bloqueado por divergência de total", async () => {
    const avulsaAberta = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
    });
    const { service, receivables, contracts } = fakeRepos({
      receivables: { findById: vi.fn().mockResolvedValue(avulsaAberta) },
    });
    await service.remove(ORG, "rec-avulsa");
    expect(receivables.delete).toHaveBeenCalledWith(ORG, "rec-avulsa");
    expect(contracts.findByIdForOrg).not.toHaveBeenCalled();
  });

  it("remove em parcela paga -> ConflictError (regressão: bloqueio pré-existente continua valendo, checado antes da soma)", async () => {
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(fakeReceivable({ paidAt: new Date("2026-07-01") })),
      },
    });
    await expect(service.remove(ORG, "rec-1")).rejects.toThrow(ConflictError);
    expect(receivables.delete).not.toHaveBeenCalled();
  });

  it("update funciona em avulsa aberta (contractId null) -- service não exige contrato", async () => {
    const avulsaAberta = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
    });
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(avulsaAberta),
        update: vi.fn().mockResolvedValue({ ...avulsaAberta, amount: "1800.00" }),
      },
    });
    await service.update(ORG, "rec-avulsa", { amount: 1800 });
    expect(receivables.update).toHaveBeenCalledWith(
      ORG,
      "rec-avulsa",
      expect.objectContaining({ amount: "1800.00" }),
    );
  });

  it("remove funciona em avulsa aberta (contractId null)", async () => {
    const avulsaAberta = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
    });
    const { service, receivables } = fakeRepos({
      receivables: { findById: vi.fn().mockResolvedValue(avulsaAberta) },
    });
    await service.remove(ORG, "rec-avulsa");
    expect(receivables.delete).toHaveBeenCalledWith(ORG, "rec-avulsa");
  });

  it("update de description numa avulsa aberta corrige o texto que identifica o lançamento", async () => {
    const avulsaAberta = fakeReceivable({
      id: "rec-avulsa",
      contractId: null,
      kind: "AVULSA",
      installmentIndex: 0,
      description: "Consultoria avulsa (com erro de digitação)",
    });
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(avulsaAberta),
        update: vi
          .fn()
          .mockResolvedValue({ ...avulsaAberta, description: "Consultoria avulsa pro Rick" }),
      },
    });
    const result = await service.update(ORG, "rec-avulsa", {
      description: "Consultoria avulsa pro Rick",
    });
    expect(receivables.update).toHaveBeenCalledWith(
      ORG,
      "rec-avulsa",
      expect.objectContaining({ description: "Consultoria avulsa pro Rick" }),
    );
    expect(result.description).toBe("Consultoria avulsa pro Rick");
  });

  it("update de description numa PARCELA de contrato também funciona -- o campo existe pra ambas as origens, não só avulsa", async () => {
    const parcelaAberta = fakeReceivable({
      id: "rec-1",
      contractId: CONTRACT_ID,
      kind: "PARCELA",
      installmentIndex: 1,
      description: null,
    });
    const { service, receivables } = fakeRepos({
      receivables: {
        findById: vi.fn().mockResolvedValue(parcelaAberta),
        update: vi.fn().mockResolvedValue({ ...parcelaAberta, description: "Nota da parcela" }),
      },
    });
    const result = await service.update(ORG, "rec-1", { description: "Nota da parcela" });
    expect(receivables.update).toHaveBeenCalledWith(
      ORG,
      "rec-1",
      expect.objectContaining({ description: "Nota da parcela" }),
    );
    expect(result.description).toBe("Nota da parcela");
  });

  it("update sem description no patch não manda description undefined que sobrescreveria com null", async () => {
    const { service, receivables } = fakeRepos({
      contracts: {
        findByIdForOrg: vi.fn().mockResolvedValue(fakeContract({ valorTotal: "250.00" })),
      },
    });
    await service.update(ORG, "rec-1", { amount: 250 });
    const patch = vi.mocked(receivables.update).mock.calls[0]![2] as { description?: string };
    expect(patch.description).toBeUndefined();
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
    // Repo recebe a UNIÃO das duas janelas: fromUtc (dueDate, date-only) até
    // toSp (paidAt, timestamp real) -- ver comentário em `monthRangeUtc` no
    // service. A classificação exata por campo acontece em memória.
    expect(receivables.listForSummary).toHaveBeenCalledWith(
      ORG,
      new Date(Date.UTC(2026, 7, 1)),
      new Date(Date.UTC(2026, 8, 1, 3, 0, 0)),
    );

    vi.useRealTimers();
  });

  it("parcela vencendo no dia 1 (dueDate date-only, sempre meia-noite UTC) conta em 'toReceive' do mês do dia 1, não do mês anterior", async () => {
    // now ANTES do vencimento -- não é vencida, então testa o bucket de
    // toReceive (e não o de overdue, que não olha pra mês nenhum).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    // Valor REAL que o front manda pra uma parcela vencendo dia 1/09
    // (<input type="date"> -> z.coerce.date() -> sempre T00:00:00Z). Com o
    // corte de Brasília isso seria 21h de 31/08 e cairia errado em agosto --
    // dueDate usa corte UTC justamente pra evitar essa regressão.
    const dueFirstOfMonth = fakeReceivable({
      id: "rec-due-day-one",
      amount: "999.00",
      dueDate: new Date("2026-09-01T00:00:00Z"),
      paidAt: null,
    });

    const { service } = fakeRepos({
      receivables: { listForSummary: vi.fn().mockResolvedValue([dueFirstOfMonth]) },
    });

    const result = await service.summary(ORG, "2026-09");

    expect(result.toReceive).toBe("999.00");

    vi.useRealTimers();
  });

  it("corte de mês em meia-noite de Brasília, não meia-noite UTC: paidAt 01:00Z (22h de SP da véspera) cai no mês anterior, 03:00Z (meia-noite SP) cai no mês novo", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // 2026-09-01T01:00:00Z = 2026-08-31T22:00:00 em America/Sao_Paulo --
    // ainda é agosto lá, então NÃO deve contar no 'received' de setembro.
    const paidLastHourOfAugustSp = fakeReceivable({
      id: "rec-paid-edge-aug",
      amount: "111.00",
      dueDate: new Date("2026-08-20"),
      paidAt: new Date("2026-09-01T01:00:00Z"),
    });
    // 2026-09-01T03:00:00Z = meia-noite em América/Sao_Paulo -- já é
    // setembro lá, então DEVE contar no 'received' de setembro.
    const paidMidnightSp = fakeReceivable({
      id: "rec-paid-edge-sep",
      amount: "222.00",
      dueDate: new Date("2026-09-05"),
      paidAt: new Date("2026-09-01T03:00:00Z"),
    });

    const { service } = fakeRepos({
      receivables: {
        listForSummary: vi.fn().mockResolvedValue([paidLastHourOfAugustSp, paidMidnightSp]),
      },
    });

    const result = await service.summary(ORG, "2026-09");

    expect(result.received).toBe("222.00");

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

  it("avulsa paga entra em 'received' do mês -- é o caso dos R$ 1.500 do Rick sem contrato: listForSummary/summary não filtram por contrato, então uma AVULSA soma igual a qualquer parcela", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const avulsaPaga = fakeReceivable({
      id: "rec-avulsa-paga",
      contractId: null,
      description: "Consultoria avulsa pro Rick",
      kind: "AVULSA",
      installmentIndex: 0,
      amount: "1500.00",
      dueDate: new Date("2026-08-01"),
      paidAt: new Date("2026-08-09"),
    });

    const { service } = fakeRepos({
      receivables: { listForSummary: vi.fn().mockResolvedValue([avulsaPaga]) },
    });

    const result = await service.summary(ORG, "2026-08");

    expect(result.received).toBe("1500.00");
    expect(result.toReceive).toBe("0.00");
    expect(result.overdue).toBe("0.00");

    vi.useRealTimers();
  });

  it("avulsa pendente entra em 'toReceive' do mês do vencimento (regime de caixa: ainda não recebida)", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const avulsaPendente = fakeReceivable({
      id: "rec-avulsa-pendente",
      contractId: null,
      description: "Sprint avulsa",
      kind: "AVULSA",
      installmentIndex: 0,
      amount: "800.00",
      dueDate: new Date("2026-09-20"),
      paidAt: null,
    });

    const { service } = fakeRepos({
      receivables: { listForSummary: vi.fn().mockResolvedValue([avulsaPendente]) },
    });

    const result = await service.summary(ORG, "2026-09");

    expect(result.toReceive).toBe("800.00");
    expect(result.received).toBe("0.00");

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
      new Date(Date.UTC(2026, 8, 1, 3, 0, 0)),
    );

    vi.useRealTimers();
  });
});

describe("ReceivableService.series", () => {
  it("parcela com dueDate em jul e paidAt em ago conta em 'expected' de jul E 'received' de ago", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const straddling = fakeReceivable({
      id: "rec-straddle",
      amount: "100.00",
      dueDate: new Date("2026-07-10"),
      paidAt: new Date("2026-08-05"),
    });

    const { service } = fakeRepos({
      receivables: { listForSeries: vi.fn().mockResolvedValue([straddling]) },
    });

    const result = await service.series(ORG, 12);

    const july = result.months.find((m) => m.month === "2026-07");
    const august = result.months.find((m) => m.month === "2026-08");
    expect(july).toEqual({ month: "2026-07", received: "0.00", expected: "100.00" });
    expect(august).toEqual({ month: "2026-08", received: "100.00", expected: "0.00" });

    vi.useRealTimers();
  });

  it("mês sem registro vem zerado e a série tem exatamente N entradas em ordem cronológica", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const { service } = fakeRepos({
      receivables: { listForSeries: vi.fn().mockResolvedValue([]) },
    });

    const result = await service.series(ORG, 5);

    expect(result.months).toHaveLength(5);
    expect(result.months.map((m) => m.month)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    for (const point of result.months) {
      expect(point.received).toBe("0.00");
      expect(point.expected).toBe("0.00");
    }

    vi.useRealTimers();
  });

  it("janela de 3 meses busca do repo com from/to cobrindo só os 3 meses (+ ano corrente)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const { service, receivables } = fakeRepos();

    await service.series(ORG, 3);

    // from = início de jan/2026 em UTC (yearFromUtc é mais antigo que
    // fromUtc da janela de 3 meses, que começaria em jun/2026).
    // to = início de jan/2027 em meia-noite de Brasília (yearToSp é mais
    // tarde que toUtc da janela de 3 meses, que seria set/2026) -- Sp
    // sempre vence no `to` porque paidAt usa o corte de Brasília.
    expect(receivables.listForSeries).toHaveBeenCalledWith(
      ORG,
      new Date(Date.UTC(2026, 0, 1)),
      new Date(Date.UTC(2027, 0, 1, 3, 0, 0)),
    );

    vi.useRealTimers();
  });

  it("dueDate e paidAt têm cortes diferentes na MESMA parcela: dueDate (date-only, sempre T00:00:00Z) usa meia-noite UTC -- dia 1 cai no mês do dia 1; paidAt (timestamp real) usa meia-noite de Brasília", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T12:00:00Z"));

    // dueDate "dia 1 de setembro" é o valor REAL que o front manda pra uma
    // parcela vencendo dia 1/09 -- precisa continuar caindo em setembro
    // (corte UTC, não SP -- essa foi a regressão do Critical: aplicar corte
    // de Brasília aqui empurraria todo vencimento dia 1 pro mês anterior).
    // paidAt "2026-09-01T01:00:00Z" é 22h de 31/08 em Brasília -- timestamp
    // real, precisa cair em agosto (corte SP).
    const straddlingCut = fakeReceivable({
      id: "rec-straddle-cuts",
      amount: "500.00",
      dueDate: new Date("2026-09-01T00:00:00Z"),
      paidAt: new Date("2026-09-01T01:00:00Z"),
    });

    const { service } = fakeRepos({
      receivables: { listForSeries: vi.fn().mockResolvedValue([straddlingCut]) },
    });

    const result = await service.series(ORG, 12);

    const august = result.months.find((m) => m.month === "2026-08")!;
    const september = result.months.find((m) => m.month === "2026-09")!;
    expect(september.expected).toBe("500.00"); // dueDate: corte UTC, dia 1 = setembro
    expect(august.received).toBe("500.00"); // paidAt: corte SP, 01:00Z = 22h de 31/08

    vi.useRealTimers();
  });

  it("avulsas entram na série igual a parcelas de contrato: uma paga no mês X aparece em received[X], uma pendente com dueDate em Y aparece em expected[Y] -- o caso dos R$ 1.500 do Rick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00Z"));

    const avulsaPagaEmAgosto = fakeReceivable({
      id: "rec-avulsa-paga",
      contractId: null,
      description: "Consultoria avulsa pro Rick",
      kind: "AVULSA",
      installmentIndex: 0,
      amount: "1500.00",
      dueDate: new Date("2026-08-01"),
      paidAt: new Date("2026-08-09"),
    });
    const avulsaPendenteEmJunho = fakeReceivable({
      id: "rec-avulsa-pendente",
      contractId: null,
      description: "Sprint avulsa",
      kind: "AVULSA",
      installmentIndex: 0,
      amount: "2000.00",
      dueDate: new Date("2026-06-15"),
      paidAt: null,
    });

    const { service } = fakeRepos({
      receivables: {
        listForSeries: vi.fn().mockResolvedValue([avulsaPagaEmAgosto, avulsaPendenteEmJunho]),
      },
    });

    const result = await service.series(ORG, 12);

    const august = result.months.find((m) => m.month === "2026-08")!;
    const june = result.months.find((m) => m.month === "2026-06")!;
    expect(august.received).toBe("1500.00");
    expect(june.expected).toBe("2000.00");

    vi.useRealTimers();
  });

  it("yearTotals soma só o ano corrente, mesmo com registros de anos anteriores na janela da série", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-10T12:00:00Z"));

    // Fora do ano corrente (2025) -- deve aparecer no bucket mensal mas NÃO em yearTotals.
    const lastYear = fakeReceivable({
      id: "rec-last-year",
      amount: "100.00",
      dueDate: new Date("2025-12-01"),
      paidAt: new Date("2025-12-05"),
    });
    // Aberta em jan/2026, dentro do ano corrente.
    const openThisYear = fakeReceivable({
      id: "rec-open-this-year",
      amount: "50.00",
      dueDate: new Date("2026-01-10"),
      paidAt: null,
    });
    // Paga no mês corrente (fev/2026), dentro do ano corrente.
    const paidThisMonth = fakeReceivable({
      id: "rec-paid-this-month",
      amount: "75.00",
      dueDate: new Date("2026-02-05"),
      paidAt: new Date("2026-02-05"),
    });

    const { service } = fakeRepos({
      receivables: {
        listForSeries: vi.fn().mockResolvedValue([lastYear, openThisYear, paidThisMonth]),
      },
    });

    const result = await service.series(ORG, 12);

    expect(result.yearTotals).toEqual({ year: 2026, received: "75.00", expected: "125.00" });

    const dec2025 = result.months.find((m) => m.month === "2025-12");
    expect(dec2025).toEqual({ month: "2025-12", received: "100.00", expected: "100.00" });

    vi.useRealTimers();
  });
});

describe("ReceivableService.margin", () => {
  it("com orçamento vinculado: projectedCost e realizedMargin calculados", async () => {
    const { service, contracts, estimateService } = fakeRepos({
      contracts: {
        findByIdForOrg: vi
          .fn()
          .mockResolvedValue(fakeContract({ proposalId: "proposal-1", valorTotal: "1000.00" })),
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
    const { service } = fakeRepos({
      contracts: { findByIdForOrg: vi.fn().mockResolvedValue(null) },
    });
    await expect(service.margin(ORG, CONTRACT_ID)).rejects.toThrow(NotFoundError);
  });
});
