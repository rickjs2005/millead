import { describe, expect, it } from "vitest";
import type {
  PersonalTransaction,
  PersonalTransactionSplit,
} from "../../domain/entities/personal-finance.js";
import type {
  BusinessAllocation,
  BusinessExpense,
  BusinessExpenseRepository,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "../../domain/repositories/business-expense-repository.js";
import type { PersonalTransactionRepository } from "../../domain/repositories/personal-transaction-repository.js";
import { PersonalBridgeService } from "./personal-bridge-service.js";
import { utcDate } from "./vault-date.js";

const VAULT = "vault-1";
const ORG = "org-1";

function makeFakes(planosDaOrg: string[] = ["plan-claude"]) {
  const transactions: PersonalTransaction[] = [];
  const splits: PersonalTransactionSplit[] = [];
  const expenses: BusinessExpense[] = [];
  const allocations: BusinessAllocation[] = [];
  let seq = 0;

  const expenseRepo = {
    async list() {
      return expenses;
    },
    async findById(organizationId: string, id: string) {
      return expenses.find((e) => e.id === id && e.organizationId === organizationId) ?? null;
    },
    async costSubscriptionExists(_org: string, id: string) {
      return planosDaOrg.includes(id);
    },
    async createWithAllocation(
      organizationId: string,
      vaultId: string,
      transactionId: string,
      input: CreateExpenseInput,
    ) {
      const expense: BusinessExpense = {
        id: `exp-${++seq}`,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      expenses.push(expense);
      const allocation: BusinessAllocation = {
        id: `alloc-${++seq}`,
        vaultId,
        transactionId,
        businessExpenseId: expense.id,
        organizationId,
        amount: input.amount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      allocations.push(allocation);
      return { expense, allocation };
    },
    async findAllocationByTransaction(vaultId: string, transactionId: string) {
      return (
        allocations.find((a) => a.vaultId === vaultId && a.transactionId === transactionId) ?? null
      );
    },
    async listAllocations(vaultId: string) {
      return allocations.filter((a) => a.vaultId === vaultId);
    },
    async syncAllocation(
      vaultId: string,
      transactionId: string,
      amount: string,
      patch: UpdateExpenseInput,
    ) {
      const alloc = allocations.find(
        (a) => a.vaultId === vaultId && a.transactionId === transactionId,
      );
      if (!alloc) return null;
      const expense = expenses.find((e) => e.id === alloc.businessExpenseId)!;
      Object.assign(expense, patch, { amount });
      alloc.amount = amount;
      return { expense, allocation: alloc };
    },
    async revertAllocation(vaultId: string, transactionId: string) {
      const i = allocations.findIndex(
        (a) => a.vaultId === vaultId && a.transactionId === transactionId,
      );
      if (i < 0) return false;
      const [alloc] = allocations.splice(i, 1);
      const j = expenses.findIndex((e) => e.id === alloc!.businessExpenseId);
      if (j >= 0) expenses.splice(j, 1);
      return true;
    },
  } as unknown as BusinessExpenseRepository;

  const transactionRepo = {
    async findById(_v: string, id: string) {
      return transactions.find((t) => t.id === id) ?? null;
    },
    async listSplitsFor(_v: string, ids: string[]) {
      const map = new Map<string, PersonalTransactionSplit[]>();
      for (const id of ids) {
        const list = splits.filter((s) => s.transactionId === id);
        if (list.length) map.set(id, list);
      }
      return map;
    },
    async listWithBusinessSplits() {
      return transactions
        .filter((t) => splits.some((s) => s.transactionId === t.id && s.kind === "BUSINESS"))
        .map((t) => ({
          transaction: t,
          businessAmount: splits
            .filter((s) => s.transactionId === t.id && s.kind === "BUSINESS")
            .reduce((total, s) => total + Number(s.amount), 0)
            .toFixed(2),
        }));
    },
  } as unknown as PersonalTransactionRepository;

  const service = new PersonalBridgeService(expenseRepo, transactionRepo);

  function compra(over: Partial<PersonalTransaction> = {}): PersonalTransaction {
    const tx = {
      id: `tx-${++seq}`,
      vaultId: VAULT,
      accountId: null,
      cardId: "card-1",
      transactionDate: utcDate(2026, 8, 5),
      settlementDate: null,
      originalDescription: "ANTHROPIC CLAUDE AI SUBSCR *US",
      normalizedDescription: "anthropic claude ai subscr us",
      merchantId: null,
      categoryId: null,
      direction: "OUT",
      amount: "300.00",
      currency: "BRL",
      originalAmount: null,
      originalCurrency: null,
      amountBrl: "300.00",
      source: "MANUAL",
      importBatchId: null,
      subscriptionId: null,
      externalId: null,
      fingerprint: null,
      status: "CONFIRMED",
      note: null,
      statementId: null,
      installmentNumber: null,
      installmentTotal: null,
      isTransfer: false,
      transferPairId: null,
      settlesDebtId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...over,
    } as PersonalTransaction;
    transactions.push(tx);
    return tx;
  }

  function rateio(transactionId: string, kind: PersonalTransactionSplit["kind"], amount: string) {
    splits.push({
      id: `split-${++seq}`,
      transactionId,
      kind,
      amount,
      categoryId: null,
      note: null,
    });
  }

  return { service, expenses, allocations, splits, compra, rateio };
}

const pedido = {
  description: "Claude Pro — uso da MilWeb",
  category: "AI" as const,
  costSubscriptionId: null,
  companyId: null,
  notes: null,
};

describe("enviar pro financeiro", () => {
  it("manda só a parte empresarial, nunca o valor da compra", async () => {
    const f = makeFakes();
    const compra = f.compra({ amountBrl: "300.00" });
    f.rateio(compra.id, "BUSINESS", "100.00");

    const item = await f.service.push(VAULT, ORG, compra.id, pedido);

    // Mandar 300 cobraria da MilWeb um dinheiro que ela não deve -- e o número
    // seria plausível o bastante pra passar batido no fechamento.
    expect(item.businessAmount).toBe("100.00");
    expect(f.expenses[0]!.amount).toBe("100.00");
    expect(item.state).toBe("ENVIADA");
  });

  it("a descrição é a que a pessoa escreveu, não a linha do extrato", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");

    await f.service.push(VAULT, ORG, compra.id, pedido);

    expect(f.expenses[0]!.description).toBe("Claude Pro — uso da MilWeb");
    expect(f.expenses[0]!.description).not.toContain("ANTHROPIC");
  });

  it("a despesa não guarda nada que leve de volta ao Cofre", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");

    await f.service.push(VAULT, ORG, compra.id, pedido);

    const despesa = JSON.stringify(f.expenses[0]);
    expect(despesa).not.toContain(compra.id);
    expect(despesa).not.toContain(VAULT);
    expect(despesa).not.toContain("card-1");
    // O elo existe, mas mora do outro lado -- e só o Cofre o lê.
    expect(f.allocations[0]!.transactionId).toBe(compra.id);
  });

  it("sempre em reais: o Cofre já sabe o que saiu, com IOF e spread", async () => {
    const f = makeFakes();
    const compra = f.compra({
      originalAmount: "20.00",
      originalCurrency: "USD",
      amountBrl: "118.40",
    });
    f.rateio(compra.id, "BUSINESS", "118.40");

    await f.service.push(VAULT, ORG, compra.id, pedido);

    // Reconverter pela cotação de hoje reescreveria o passado a cada oscilação.
    expect(f.expenses[0]!.currency).toBe("BRL");
    expect(f.expenses[0]!.amount).toBe("118.40");
  });

  it("recusa compra sem parte empresarial", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "REIMBURSABLE", "100.00");

    await expect(f.service.push(VAULT, ORG, compra.id, pedido)).rejects.toThrow(
      /não tem parte empresarial/,
    );
    expect(f.expenses).toHaveLength(0);
  });

  it("recusa compra estornada", async () => {
    const f = makeFakes();
    const compra = f.compra({ status: "REVERSED" });
    f.rateio(compra.id, "BUSINESS", "100.00");

    await expect(f.service.push(VAULT, ORG, compra.id, pedido)).rejects.toThrow(/estornada/);
  });

  it("recusa entrada — só saída vira despesa", async () => {
    const f = makeFakes();
    const compra = f.compra({ direction: "IN" });
    f.rateio(compra.id, "BUSINESS", "100.00");

    await expect(f.service.push(VAULT, ORG, compra.id, pedido)).rejects.toThrow(/saída/);
  });

  it("recusa plano de custo de outra organização", async () => {
    // Não há FK entre os dois mundos; esta checagem é o que faz esse papel.
    const f = makeFakes(["plan-claude"]);
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");

    await expect(
      f.service.push(VAULT, ORG, compra.id, { ...pedido, costSubscriptionId: "plan-de-outra-org" }),
    ).rejects.toThrow(/não encontrada nesta organização/);
    expect(f.expenses).toHaveLength(0);
  });
});

describe("enviar duas vezes", () => {
  it("é recusado — a mesma compra não dobra o custo da MilWeb", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");
    await f.service.push(VAULT, ORG, compra.id, pedido);

    await expect(f.service.push(VAULT, ORG, compra.id, pedido)).rejects.toThrow(/sincronize/);
    expect(f.expenses).toHaveLength(1);
  });
});

describe("rateio mudou depois do envio", () => {
  it("aparece como DESATUALIZADA em vez de ser corrigido sozinho", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");
    await f.service.push(VAULT, ORG, compra.id, pedido);

    f.splits.length = 0;
    f.rateio(compra.id, "BUSINESS", "150.00");

    const item = await f.service.status(VAULT, compra.id);
    // Reescrever a contabilidade da empresa sem ninguém pedir é pior que
    // mostrar a diferença: o mês pode já ter fechado com o número antigo.
    expect(item.state).toBe("DESATUALIZADA");
    expect(item.sentAmount).toBe("100.00");
    expect(item.businessAmount).toBe("150.00");
    expect(f.expenses[0]!.amount).toBe("100.00");
  });

  it("sincronizar alinha os dois lados, sem criar um segundo lançamento", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");
    await f.service.push(VAULT, ORG, compra.id, pedido);

    f.splits.length = 0;
    f.rateio(compra.id, "BUSINESS", "150.00");
    const item = await f.service.sync(VAULT, compra.id);

    expect(item.state).toBe("ENVIADA");
    expect(f.expenses).toHaveLength(1);
    expect(f.expenses[0]!.amount).toBe("150.00");
  });

  it("sincronizar sem envio prévio é 404, não cria nada", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");

    await expect(f.service.sync(VAULT, compra.id)).rejects.toThrow(/ainda não foi enviada/);
    expect(f.expenses).toHaveLength(0);
  });
});

describe("desfazer", () => {
  it("apaga a despesa e devolve a compra a NAO_ENVIADA, sem tocar no rateio", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");
    await f.service.push(VAULT, ORG, compra.id, pedido);

    const item = await f.service.revert(VAULT, compra.id);

    expect(item.state).toBe("NAO_ENVIADA");
    expect(f.expenses).toHaveLength(0);
    expect(f.allocations).toHaveLength(0);
    expect(f.splits).toHaveLength(1); // o rateio pessoal continua lá
  });

  it("desfazer libera um novo envio", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");
    await f.service.push(VAULT, ORG, compra.id, pedido);
    await f.service.revert(VAULT, compra.id);

    const item = await f.service.push(VAULT, ORG, compra.id, pedido);
    expect(item.state).toBe("ENVIADA");
    expect(f.expenses).toHaveLength(1);
  });
});

describe("listagem", () => {
  it("mostra o estado de cada compra com parte empresarial", async () => {
    const f = makeFakes();
    const enviada = f.compra();
    f.rateio(enviada.id, "BUSINESS", "100.00");
    const pendente = f.compra();
    f.rateio(pendente.id, "BUSINESS", "50.00");
    await f.service.push(VAULT, ORG, enviada.id, pedido);

    const itens = await f.service.list(VAULT, { from: null, to: null });

    expect(itens).toHaveLength(2);
    expect(itens.find((i) => i.transactionId === enviada.id)!.state).toBe("ENVIADA");
    expect(itens.find((i) => i.transactionId === pendente.id)!.state).toBe("NAO_ENVIADA");
  });
});

describe("porta BusinessLinkChecker", () => {
  it("descreve a despesa gerada por uma compra", async () => {
    const f = makeFakes();
    const compra = f.compra();
    f.rateio(compra.id, "BUSINESS", "100.00");
    await f.service.push(VAULT, ORG, compra.id, pedido);

    expect(await f.service.describeBusinessLink(VAULT, compra.id)).toContain(
      "Claude Pro — uso da MilWeb",
    );
  });

  it("devolve null quando a compra não foi enviada", async () => {
    const f = makeFakes();
    const compra = f.compra();
    expect(await f.service.describeBusinessLink(VAULT, compra.id)).toBeNull();
  });
});
