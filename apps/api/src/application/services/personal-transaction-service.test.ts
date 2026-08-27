import { beforeEach, describe, expect, it } from "vitest";
import type {
  PersonalAccount,
  PersonalCreditCard,
  PersonalStatement,
  PersonalTransaction,
  PersonalTransactionSplit,
} from "../../domain/entities/personal-finance.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalAccountRepository } from "../../domain/repositories/personal-account-repository.js";
import type { PersonalStatementRepository } from "../../domain/repositories/personal-statement-repository.js";
import type {
  CreateTransactionInput,
  PersonalTransactionRepository,
  SplitInput,
  TransactionFilters,
} from "../../domain/repositories/personal-transaction-repository.js";
import {
  PersonalTransactionService,
  type CreateManualTransactionInput,
} from "./personal-transaction-service.js";
import { formatUtcDate, utcDate } from "./vault-date.js";
import { parseMoney, sumMoney } from "./vault-money.js";

const VAULT = "vault-1";

/**
 * Repositórios em memória. Não são mocks de asserção: são implementações
 * pequenas e corretas o bastante pra o teste exercitar a REGRA (que fatura, que
 * total, que rateio) sem banco. Mocks com `mockResolvedValue` provariam só que
 * o service chama métodos — não que a conta fecha.
 */
function makeFakes() {
  const accounts: PersonalAccount[] = [
    account("acc-1", "Conta principal"),
    account("acc-2", "Carteira"),
  ];
  const cards: PersonalCreditCard[] = [
    {
      id: "card-1",
      vaultId: VAULT,
      name: "Cartão",
      institution: null,
      last4: "1234",
      limitAmount: "5000.00",
      closingDay: 10,
      dueDay: 17,
      paymentAccountId: "acc-1",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
  const transactions: PersonalTransaction[] = [];
  const splits: PersonalTransactionSplit[] = [];
  const statements: PersonalStatement[] = [];
  let seq = 0;

  const accountRepo: PersonalAccountRepository = {
    listAccounts: async () => accounts,
    findAccount: async (vaultId, id) =>
      accounts.find((a) => a.id === id && vaultId === VAULT) ?? null,
    createAccount: async () => accounts[0]!,
    updateAccount: async () => null,
    deleteAccount: async () => true,
    listCards: async () => cards,
    findCard: async (vaultId, id) => cards.find((c) => c.id === id && vaultId === VAULT) ?? null,
    createCard: async () => cards[0]!,
    updateCard: async () => null,
    deleteCard: async () => true,
  };

  const transactionRepo: PersonalTransactionRepository = {
    list: async (_v, filters: TransactionFilters) => ({
      items: transactions.filter((t) => (filters.includeTransfers ? true : !t.isTransfer)),
      total: transactions.length,
    }),
    findById: async (_v, id) => transactions.find((t) => t.id === id) ?? null,
    listSplitsFor: async (_v, ids) => {
      const map = new Map<string, PersonalTransactionSplit[]>();
      for (const id of ids) {
        const list = splits.filter((s) => s.transactionId === id);
        if (list.length) map.set(id, list);
      }
      return map;
    },
    create: async (_v, input: CreateTransactionInput) => {
      const created: PersonalTransaction = {
        id: `tx-${++seq}`,
        vaultId: VAULT,
        transferPairId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      transactions.push(created);
      return created;
    },
    update: async (_v, id, patch) => {
      const found = transactions.find((t) => t.id === id);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    delete: async (_v, id) => {
      const index = transactions.findIndex((t) => t.id === id);
      if (index < 0) return false;
      transactions.splice(index, 1);
      return true;
    },
    linkTransferPair: async (_v, first, second) => {
      const a = transactions.find((t) => t.id === first);
      const b = transactions.find((t) => t.id === second);
      if (a) a.transferPairId = second;
      if (b) b.transferPairId = first;
    },
    replaceSplits: async (_v, transactionId, next: SplitInput[]) => {
      if (!transactions.some((t) => t.id === transactionId)) return false;
      for (let i = splits.length - 1; i >= 0; i--) {
        if (splits[i]!.transactionId === transactionId) splits.splice(i, 1);
      }
      next.forEach((split, index) =>
        splits.push({ id: `sp-${transactionId}-${index}`, transactionId, ...split }),
      );
      return true;
    },
    createManyFromImport: async (_v, rows) => {
      // Espelha o `skipDuplicates` do banco: linha cujo fingerprint já existe
      // não entra, e a contagem devolvida é só o que entrou de fato.
      const existentes = new Set(
        transactions.flatMap((t) => (t.fingerprint ? [t.fingerprint] : [])),
      );
      let count = 0;
      for (const row of rows) {
        if (row.fingerprint && existentes.has(row.fingerprint)) continue;
        if (row.fingerprint) existentes.add(row.fingerprint);
        transactions.push({
          id: `tx-${++seq}`,
          vaultId: VAULT,
          transferPairId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...row,
        });
        count++;
      }
      return count;
    },
    findClassificationByExternalId: async () => null,
    listClassificationHistory: async () => [],
    findExistingFingerprints: async (_v, fingerprints) =>
      new Set(fingerprints.filter((fp) => transactions.some((t) => t.fingerprint === fp))),
    sumByStatement: async (_v, statementId) =>
      String(
        sumMoney(
          transactions
            .filter((t) => t.statementId === statementId && t.status !== "REVERSED")
            .map((t) => t.amountBrl),
        ) / 100,
      ),
  };

  const statementRepo: PersonalStatementRepository = {
    list: async () => statements,
    findById: async (_v, id) => statements.find((s) => s.id === id) ?? null,
    ensureForPeriod: async (_v, input) => {
      const key = formatUtcDate(input.referenceMonth);
      const existing = statements.find(
        (s) => s.cardId === input.cardId && formatUtcDate(s.referenceMonth) === key,
      );
      if (existing) return existing;
      const created: PersonalStatement = {
        id: `st-${key}`,
        vaultId: VAULT,
        cardId: input.cardId,
        referenceMonth: input.referenceMonth,
        closingDate: input.closingDate,
        dueDate: input.dueDate,
        totalAmount: "0.00",
        paidAmount: "0.00",
        status: "OPEN",
      };
      statements.push(created);
      return created;
    },
    updateTotal: async (_v, id, totalAmount) => {
      const found = statements.find((s) => s.id === id);
      if (!found) return null;
      found.totalAmount = totalAmount;
      return found;
    },
    registerPayment: async (_v, id, paidAmount, status) => {
      const found = statements.find((s) => s.id === id);
      if (!found) return null;
      found.paidAmount = paidAmount;
      found.status = status;
      return found;
    },
  };

  const service = new PersonalTransactionService(transactionRepo, accountRepo, statementRepo);
  return { service, transactions, splits, statements };
}

function account(id: string, name: string): PersonalAccount {
  return {
    id,
    vaultId: VAULT,
    name,
    institution: null,
    type: "CHECKING",
    currency: "BRL",
    last4: null,
    reportedBalance: null,
    reportedBalanceAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function manual(over: Partial<CreateManualTransactionInput> = {}): CreateManualTransactionInput {
  return {
    accountId: "acc-1",
    cardId: null,
    transactionDate: utcDate(2026, 8, 5),
    settlementDate: null,
    description: "Compra",
    merchantId: null,
    categoryId: null,
    direction: "OUT",
    amount: "100.00",
    currency: "BRL",
    originalAmount: null,
    originalCurrency: null,
    amountBrl: null,
    note: null,
    installmentNumber: null,
    installmentTotal: null,
    isTransfer: false,
    ...over,
  };
}

let fakes: ReturnType<typeof makeFakes>;
beforeEach(() => {
  fakes = makeFakes();
});

describe("origem da movimentação", () => {
  it("recusa conta E cartão ao mesmo tempo", async () => {
    await expect(
      fakes.service.create(VAULT, manual({ accountId: "acc-1", cardId: "card-1" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("recusa sem conta e sem cartão", async () => {
    await expect(
      fakes.service.create(VAULT, manual({ accountId: null, cardId: null })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("recusa conta que não é deste Cofre", async () => {
    await expect(
      fakes.service.create(VAULT, manual({ accountId: "conta-de-outro" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("moeda estrangeira", () => {
  it("exige o valor em BRL em vez de converter por conta própria", async () => {
    // Chutar uma taxa aqui produziria um total plausível e errado, e o erro só
    // apareceria meses depois numa conta que não fecha.
    await expect(
      fakes.service.create(VAULT, manual({ currency: "USD", amount: "20.00", amountBrl: null })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("aceita quando o valor cobrado em BRL vem junto", async () => {
    const created = await fakes.service.create(
      VAULT,
      manual({ currency: "USD", amount: "20.00", amountBrl: "112.40" }),
    );
    expect(created.amount).toBe("20.00");
    expect(created.amountBrl).toBe("112.40");
  });
});

describe("compra no cartão e fatura", () => {
  it("cai na fatura do mês quando é antes do fechamento", async () => {
    const created = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", transactionDate: utcDate(2026, 8, 5) }),
    );
    const statement = fakes.statements.find((s) => s.id === created.statementId);
    expect(formatUtcDate(statement!.referenceMonth)).toBe("2026-08-01");
    expect(formatUtcDate(statement!.dueDate)).toBe("2026-08-17");
  });

  it("cai na fatura seguinte quando é depois do fechamento", async () => {
    const created = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", transactionDate: utcDate(2026, 8, 11) }),
    );
    expect(created.statementId).toBe("st-2026-09-01");
  });

  it("o total da fatura é a soma das compras, recalculada", async () => {
    await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "100.00" }),
    );
    await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "50.50" }),
    );

    const statement = fakes.statements.find((s) => s.id === "st-2026-08-01");
    expect(statement!.totalAmount).toBe("150.5");
  });

  it("estorno tira o valor do total da fatura", async () => {
    const first = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "100.00" }),
    );
    await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "50.00" }),
    );

    await fakes.service.update(VAULT, first.id, { status: "REVERSED" });

    const statement = fakes.statements.find((s) => s.id === "st-2026-08-01");
    expect(statement!.totalAmount).toBe("50");
  });

  it("apagar a compra também recalcula", async () => {
    const created = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "100.00" }),
    );
    await fakes.service.delete(VAULT, created.id);

    const statement = fakes.statements.find((s) => s.id === "st-2026-08-01");
    expect(statement!.totalAmount).toBe("0");
  });
});

describe("divisões", () => {
  it("recusa rateio maior que o valor da movimentação", async () => {
    const created = await fakes.service.create(VAULT, manual({ amount: "300.00" }));
    await expect(
      fakes.service.replaceSplits(VAULT, created.id, [
        split("BUSINESS", "200.00"),
        split("REIMBURSABLE", "150.00"),
      ]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("gasto da MilWeb no cartão pessoal sai do consumo pessoal", async () => {
    const created = await fakes.service.create(VAULT, manual({ amount: "120.00" }));
    const detail = await fakes.service.replaceSplits(VAULT, created.id, [
      split("BUSINESS", "120.00"),
    ]);

    expect(detail.isBusiness).toBe(true);
    expect(detail.businessAmount).toBe("120.00");
    // Continua sendo saída de caixa (amountBrl), mas não consumo pessoal.
    expect(detail.amountBrl).toBe("120.00");
    expect(detail.personalConsumption).toBe("0.00");
  });

  it("substituir o rateio troca o conjunto inteiro, não acumula", async () => {
    const created = await fakes.service.create(VAULT, manual({ amount: "300.00" }));
    await fakes.service.replaceSplits(VAULT, created.id, [split("BUSINESS", "100.00")]);
    const detail = await fakes.service.replaceSplits(VAULT, created.id, [
      split("REIMBURSABLE", "50.00"),
    ]);

    expect(detail.splits).toHaveLength(1);
    expect(detail.isBusiness).toBe(false);
    expect(detail.personalConsumption).toBe("250.00");
  });

  it("movimentação inexistente não aceita rateio", async () => {
    await expect(
      fakes.service.replaceSplits(VAULT, "nao-existe", [split("BUSINESS", "1.00")]),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("transferência entre contas próprias", () => {
  it("cria as duas pernas, ligadas, e nenhuma é receita ou despesa", async () => {
    const { from, to } = await fakes.service.createTransfer(VAULT, {
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      date: utcDate(2026, 8, 20),
      amount: "500.00",
      description: "Saque",
      note: null,
    });

    expect(from.direction).toBe("OUT");
    expect(to.direction).toBe("IN");
    expect(from.isTransfer).toBe(true);
    expect(to.isTransfer).toBe(true);
    expect(from.transferPairId).toBe(to.id);
    expect(to.transferPairId).toBe(from.id);
  });

  it("some da listagem padrão — transferência não é gasto", async () => {
    await fakes.service.createTransfer(VAULT, {
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      date: utcDate(2026, 8, 20),
      amount: "500.00",
      description: "Saque",
      note: null,
    });

    const semTransferencia = await fakes.service.list(VAULT, baseFilters());
    expect(semTransferencia.items).toHaveLength(0);

    const comTransferencia = await fakes.service.list(VAULT, {
      ...baseFilters(),
      includeTransfers: true,
    });
    expect(comTransferencia.items).toHaveLength(2);
  });

  it("recusa origem igual ao destino", async () => {
    await expect(
      fakes.service.createTransfer(VAULT, {
        fromAccountId: "acc-1",
        toAccountId: "acc-1",
        date: utcDate(2026, 8, 20),
        amount: "10.00",
        description: "x",
        note: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("pagamento de fatura", () => {
  it("não vira despesa nova: a saída de caixa nasce como transferência", async () => {
    // É o ponto do módulo em que é mais fácil contar duas vezes — a compra já
    // foi a despesa; o pagamento é só o dinheiro saindo da conta.
    const compra = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "150.00" }),
    );

    await fakes.service.payStatement(
      VAULT,
      compra.statementId!,
      { amount: "150.00", date: utcDate(2026, 8, 17), accountId: "acc-1" },
      utcDate(2026, 8, 17),
    );

    const pagamento = fakes.transactions.find(
      (t) => t.originalDescription === "Pagamento de fatura",
    );
    expect(pagamento).toBeDefined();
    expect(pagamento!.isTransfer).toBe(true);
    // Crucial: o pagamento NÃO entra na fatura que ele quita.
    expect(pagamento!.statementId).toBeNull();
  });

  it("quita a fatura e marca como paga", async () => {
    const compra = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "150.00" }),
    );
    const statement = await fakes.service.payStatement(
      VAULT,
      compra.statementId!,
      { amount: "150.00", date: utcDate(2026, 8, 17), accountId: "acc-1" },
      utcDate(2026, 8, 17),
    );

    expect(statement.paidAmount).toBe("150.00");
    expect(statement.status).toBe("PAID");
  });

  it("pagamento parcial fica PARTIAL e acumula", async () => {
    const compra = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "150.00" }),
    );
    await fakes.service.payStatement(
      VAULT,
      compra.statementId!,
      { amount: "50.00", date: utcDate(2026, 8, 15), accountId: null },
      utcDate(2026, 8, 15),
    );
    const statement = await fakes.service.payStatement(
      VAULT,
      compra.statementId!,
      { amount: "30.00", date: utcDate(2026, 8, 16), accountId: null },
      utcDate(2026, 8, 16),
    );

    expect(statement.paidAmount).toBe("80.00");
    expect(statement.status).toBe("PARTIAL");
  });

  it("sem conta informada, não cria movimentação de caixa", async () => {
    // Útil quando o extrato da conta ainda vai ser importado e criaria a linha
    // de novo -- gerar as duas seria contar a saída duas vezes.
    const compra = await fakes.service.create(
      VAULT,
      manual({ accountId: null, cardId: "card-1", amount: "150.00" }),
    );
    const antes = fakes.transactions.length;

    await fakes.service.payStatement(
      VAULT,
      compra.statementId!,
      { amount: "150.00", date: utcDate(2026, 8, 17), accountId: null },
      utcDate(2026, 8, 17),
    );

    expect(fakes.transactions).toHaveLength(antes);
  });
});

function split(kind: "PERSONAL" | "REIMBURSABLE" | "BUSINESS", amount: string): SplitInput {
  return { kind, amount, categoryId: null, note: null };
}

function baseFilters(): TransactionFilters {
  return { basis: "ACCRUAL", page: 1, pageSize: 50 };
}

describe("sanidade dos fakes", () => {
  it("parseMoney concorda com os valores usados nos testes", () => {
    expect(parseMoney("150.00")).toBe(15000);
  });
});
