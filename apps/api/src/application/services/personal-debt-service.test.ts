import { describe, expect, it } from "vitest";
import type {
  PersonalTransaction,
  PersonalTransactionSplit,
} from "../../domain/entities/personal-finance.js";
import type {
  CreateContactInput,
  CreateDebtInput,
  CreatePaymentInput,
  DebtFilters,
  DebtPayment,
  PersonalContact,
  PersonalDebt,
  PersonalDebtRepository,
  UpdateContactInput,
  UpdateDebtInput,
} from "../../domain/repositories/personal-debt-repository.js";
import type {
  PersonalTransactionRepository,
  SplitInput,
} from "../../domain/repositories/personal-transaction-repository.js";
import { classifyCashFlow } from "./cash-flow-kind.js";
import { PersonalDebtService } from "./personal-debt-service.js";
import { personalConsumption } from "./split-allocation.js";
import { utcDate } from "./vault-date.js";

const VAULT = "vault-1";

/**
 * Fakes em memória, não mocks.
 *
 * O que precisa ser provado aqui é aritmético — saldo, status, o que entra no
 * consumo pessoal. `mockResolvedValue` provaria que o service chamou um
 * método; só um repositório que realmente guarda e soma prova que a conta
 * fecha.
 */
function makeFakes() {
  const contacts: PersonalContact[] = [];
  const debts: PersonalDebt[] = [];
  const transactions: PersonalTransaction[] = [];
  const splits: PersonalTransactionSplit[] = [];
  let seq = 0;

  const debtRepo: PersonalDebtRepository = {
    async listContacts(_v, includeInactive) {
      return contacts.filter((c) => includeInactive || c.isActive);
    },
    async findContactById(_v, id) {
      return contacts.find((c) => c.id === id) ?? null;
    },
    async createContact(_v, input: CreateContactInput) {
      const created: PersonalContact = {
        id: `contact-${++seq}`,
        vaultId: VAULT,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      contacts.push(created);
      return created;
    },
    async updateContact(_v, id, patch: UpdateContactInput) {
      const found = contacts.find((c) => c.id === id);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    async deleteContact(_v, id) {
      const i = contacts.findIndex((c) => c.id === id);
      if (i < 0) return false;
      contacts.splice(i, 1);
      return true;
    },
    async countDebtsForContact(_v, contactId) {
      return debts.filter((d) => d.contactId === contactId).length;
    },

    async listDebts(_v, filters: DebtFilters) {
      return debts
        .filter((d) => (filters.direction ? d.direction === filters.direction : true))
        .filter((d) => (filters.contactId ? d.contactId === filters.contactId : true))
        .filter((d) => (filters.includeCanceled ? true : d.canceledAt === null))
        .filter((d) => (filters.includeSettled ? true : pago(d) < d.originalCents));
    },
    async findDebtById(_v, id) {
      return debts.find((d) => d.id === id) ?? null;
    },
    async createDebt(_v, input: CreateDebtInput) {
      const contact = contacts.find((c) => c.id === input.contactId)!;
      const created: PersonalDebt = {
        id: `debt-${++seq}`,
        vaultId: VAULT,
        contactName: contact.name,
        canceledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        payments: [],
        ...input,
      };
      debts.push(created);
      return created;
    },
    async updateDebt(_v, id, patch: UpdateDebtInput) {
      const found = debts.find((d) => d.id === id);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    async deleteDebt(_v, id) {
      const i = debts.findIndex((d) => d.id === id);
      if (i < 0) return false;
      debts.splice(i, 1);
      return true;
    },

    async addPayment(_v, debtId, input: CreatePaymentInput) {
      const found = debts.find((d) => d.id === debtId)!;
      const payment: DebtPayment = {
        id: `pay-${++seq}`,
        debtId,
        createdAt: new Date(),
        ...input,
      };
      found.payments.push(payment);
      // O vínculo passa a valer na movimentação: é ele que faz o Pix sair da
      // receita.
      if (input.transactionId) {
        const tx = transactions.find((t) => t.id === input.transactionId);
        if (tx) tx.settlesDebtId = debtId;
      }
      return found;
    },
    async deletePayment(_v, debtId, paymentId) {
      const found = debts.find((d) => d.id === debtId);
      if (!found) return false;
      const i = found.payments.findIndex((p) => p.id === paymentId);
      if (i < 0) return false;
      const [removida] = found.payments.splice(i, 1);
      if (removida?.transactionId) {
        const tx = transactions.find((t) => t.id === removida.transactionId);
        if (tx) tx.settlesDebtId = null;
      }
      return true;
    },
    async findDebtByTransaction(_v, transactionId) {
      return debts.find((d) => d.payments.some((p) => p.transactionId === transactionId)) ?? null;
    },
  };

  // Só três métodos são reais — os que o serviço de dívidas usa. O resto
  // existir só pra satisfazer o tipo esconderia qual é a superfície de
  // acoplamento de verdade entre os dois módulos.
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
    async replaceSplits(_v: string, transactionId: string, novos: SplitInput[]) {
      for (let i = splits.length - 1; i >= 0; i--) {
        if (splits[i]!.transactionId === transactionId) splits.splice(i, 1);
      }
      for (const s of novos) {
        splits.push({ id: `split-${++seq}`, transactionId, ...s });
      }
      return true;
    },
  } as unknown as PersonalTransactionRepository;

  const service = new PersonalDebtService(debtRepo, transactionRepo);

  function addTransaction(over: Partial<PersonalTransaction> = {}): PersonalTransaction {
    const tx: PersonalTransaction = {
      id: `tx-${++seq}`,
      vaultId: VAULT,
      accountId: "acc-1",
      cardId: null,
      transactionDate: utcDate(2026, 8, 10),
      settlementDate: null,
      originalDescription: "PIX RECEBIDO",
      normalizedDescription: "pix recebido",
      merchantId: null,
      categoryId: null,
      direction: "IN",
      amount: "500.00",
      currency: "BRL",
      originalAmount: null,
      originalCurrency: null,
      amountBrl: "500.00",
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
    };
    transactions.push(tx);
    return tx;
  }

  return { service, contacts, debts, transactions, splits, addTransaction };
}

function pago(debt: PersonalDebt): number {
  return debt.payments.reduce((t, p) => t + p.amountCents, 0);
}

async function comPessoa(nome = "Bruno") {
  const fakes = makeFakes();
  const contact = await fakes.service.createContact(VAULT, {
    name: nome,
    contact: null,
    notes: null,
  });
  return { ...fakes, contact };
}

function novaDivida(
  contactId: string,
  over: Partial<Parameters<PersonalDebtService["create"]>[1]> = {},
) {
  return {
    contactId,
    direction: "THEY_OWE_ME" as const,
    description: "Emprestei pro conserto do carro",
    amount: "500.00",
    currency: "BRL" as const,
    dueDate: null,
    originTransactionId: null,
    notes: null,
    markOriginReimbursable: false,
    ...over,
  };
}

describe("dívidas nas duas direções", () => {
  it("registra alguém me devendo, com saldo cheio", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));

    expect(debt.direction).toBe("THEY_OWE_ME");
    expect(debt.originalAmount).toBe("500.00");
    expect(debt.paidAmount).toBe("0.00");
    expect(debt.balance).toBe("500.00");
    expect(debt.status).toBe("OPEN");
    expect(debt.contactName).toBe("Bruno");
  });

  it("registra eu devendo pra outra pessoa", async () => {
    const { service, contact } = await comPessoa("Marina");
    const debt = await service.create(
      VAULT,
      novaDivida(contact.id, {
        direction: "I_OWE_THEM",
        description: "Ela pagou o almoço",
        amount: "120.00",
      }),
    );

    expect(debt.direction).toBe("I_OWE_THEM");
    expect(debt.balance).toBe("120.00");
  });

  it("o resumo separa as duas direções em vez de compensar uma com a outra", async () => {
    const { service, contact } = await comPessoa();
    await service.create(VAULT, novaDivida(contact.id, { amount: "500.00" }));
    await service.create(
      VAULT,
      novaDivida(contact.id, { direction: "I_OWE_THEM", amount: "200.00" }),
    );

    const resumo = await service.summary(VAULT);
    // Compensar daria "R$300 a receber" e esconderia que existem duas dívidas.
    expect(resumo.aReceber).toBe("500.00");
    expect(resumo.aPagar).toBe("200.00");
  });
});

describe("baixas", () => {
  it("pagamento parcial deixa a dívida parcial, com o saldo certo", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));

    const depois = await service.addPayment(VAULT, debt.id, {
      amount: "200.00",
      paidAt: utcDate(2026, 8, 15),
      transactionId: null,
      note: "primeira parte",
    });

    expect(depois.status).toBe("PARTIAL");
    expect(depois.paidAmount).toBe("200.00");
    expect(depois.balance).toBe("300.00");
    expect(depois.payments).toHaveLength(1);
  });

  it("pagamento total quita — e o histórico guarda as duas devoluções", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));

    await service.addPayment(VAULT, debt.id, {
      amount: "200.00",
      paidAt: utcDate(2026, 8, 15),
      transactionId: null,
      note: null,
    });
    const quitada = await service.addPayment(VAULT, debt.id, {
      amount: "300.00",
      paidAt: utcDate(2026, 8, 20),
      transactionId: null,
      note: null,
    });

    expect(quitada.status).toBe("PAID");
    expect(quitada.balance).toBe("0.00");
    expect(quitada.payments.map((p) => p.amount)).toEqual(["200.00", "300.00"]);
  });

  it("recusa baixa maior que o saldo", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    await service.addPayment(VAULT, debt.id, {
      amount: "400.00",
      paidAt: utcDate(2026, 8, 15),
      transactionId: null,
      note: null,
    });

    await expect(
      service.addPayment(VAULT, debt.id, {
        amount: "200.00",
        paidAt: utcDate(2026, 8, 16),
        transactionId: null,
        note: null,
      }),
    ).rejects.toThrow(/maior que o saldo devedor/);
  });

  it("remover a baixa devolve a dívida ao estado anterior", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    const comBaixa = await service.addPayment(VAULT, debt.id, {
      amount: "500.00",
      paidAt: utcDate(2026, 8, 15),
      transactionId: null,
      note: null,
    });
    expect(comBaixa.status).toBe("PAID");

    const semBaixa = await service.deletePayment(VAULT, debt.id, comBaixa.payments[0]!.id);
    expect(semBaixa.status).toBe("OPEN");
    expect(semBaixa.balance).toBe("500.00");
  });
});

describe("atraso", () => {
  it("dívida vencida e não quitada aparece como atrasada, e conta no resumo", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(
      VAULT,
      novaDivida(contact.id, { dueDate: utcDate(2020, 1, 1) }),
    );
    expect(debt.status).toBe("OVERDUE");

    const resumo = await service.summary(VAULT);
    expect(resumo.atrasadasReceber).toBe(1);
    expect(resumo.atrasadasPagar).toBe(0);
  });

  it("cancelar tira a dívida do atraso e do resumo", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(
      VAULT,
      novaDivida(contact.id, { dueDate: utcDate(2020, 1, 1) }),
    );

    const cancelada = await service.update(VAULT, debt.id, { canceled: true });
    expect(cancelada.status).toBe("CANCELED");

    const resumo = await service.summary(VAULT);
    expect(resumo.aReceber).toBe("0.00");
    expect(resumo.atrasadasReceber).toBe(0);
  });
});

describe("o Pix que quita não é renda", () => {
  it("vincula a entrada à baixa e tira ela dos totais de receita", async () => {
    const { service, contact, addTransaction } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    const pix = addTransaction({ direction: "IN", amount: "500.00", amountBrl: "500.00" });

    // Antes do vínculo, é uma entrada comum — receita.
    expect(classifyCashFlow(pix)).toBe("INCOME");

    const quitada = await service.addPayment(VAULT, debt.id, {
      amount: "500.00",
      paidAt: utcDate(2026, 8, 20),
      transactionId: pix.id,
      note: null,
    });

    expect(quitada.status).toBe("PAID");
    // Depois do vínculo, o mesmo dinheiro deixa de ser receita: ele já foi
    // contado quando a dívida nasceu.
    expect(classifyCashFlow(pix)).toBe("DEBT_SETTLEMENT");
    expect(pix.settlesDebtId).toBe(debt.id);
  });

  it("recusa vincular uma saída à dívida que alguém me deve", async () => {
    const { service, contact, addTransaction } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    const saida = addTransaction({ direction: "OUT" });

    await expect(
      service.addPayment(VAULT, debt.id, {
        amount: "500.00",
        paidAt: utcDate(2026, 8, 20),
        transactionId: saida.id,
        note: null,
      }),
    ).rejects.toThrow(/ENTRADA/);
  });

  it("recusa usar transferência entre contas próprias como baixa", async () => {
    const { service, contact, addTransaction } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    const transferencia = addTransaction({ direction: "IN", isTransfer: true });

    await expect(
      service.addPayment(VAULT, debt.id, {
        amount: "500.00",
        paidAt: utcDate(2026, 8, 20),
        transactionId: transferencia.id,
        note: null,
      }),
    ).rejects.toThrow(/não te deve dinheiro/);
  });

  it("recusa usar a mesma movimentação pra baixar duas dívidas", async () => {
    const { service, contact, addTransaction } = await comPessoa();
    const primeira = await service.create(VAULT, novaDivida(contact.id, { amount: "200.00" }));
    const segunda = await service.create(VAULT, novaDivida(contact.id, { amount: "200.00" }));
    const pix = addTransaction({ direction: "IN", amount: "200.00", amountBrl: "200.00" });

    await service.addPayment(VAULT, primeira.id, {
      amount: "200.00",
      paidAt: utcDate(2026, 8, 20),
      transactionId: pix.id,
      note: null,
    });

    // Sem esta trava, R$200 baixariam R$400 e o Cofre teria inventado dinheiro.
    await expect(
      service.addPayment(VAULT, segunda.id, {
        amount: "200.00",
        paidAt: utcDate(2026, 8, 20),
        transactionId: pix.id,
        note: null,
      }),
    ).rejects.toThrow(/já baixa a dívida/);
  });
});

describe("compra reembolsável", () => {
  it("sai do consumo pessoal no mesmo instante em que vira valor a receber", async () => {
    const { service, contact, addTransaction, splits } = await comPessoa();
    const jantar = addTransaction({
      direction: "OUT",
      originalDescription: "RESTAURANTE",
      amount: "300.00",
      amountBrl: "300.00",
    });

    await service.create(
      VAULT,
      novaDivida(contact.id, {
        description: "Parte do Bruno no jantar",
        amount: "100.00",
        originTransactionId: jantar.id,
        markOriginReimbursable: true,
      }),
    );

    const rateio = splits.filter((s) => s.transactionId === jantar.id);
    expect(rateio).toHaveLength(1);
    expect(rateio[0]!.kind).toBe("REIMBURSABLE");
    // Saíram R$300 da conta, mas só R$200 são gasto seu.
    expect(personalConsumption(jantar.amountBrl, rateio)).toBe("200.00");
  });

  it("preserva o rateio que já existia na compra", async () => {
    const { service, contact, addTransaction, splits } = await comPessoa();
    const compra = addTransaction({ direction: "OUT", amount: "300.00", amountBrl: "300.00" });
    splits.push({
      id: "split-existente",
      transactionId: compra.id,
      kind: "BUSINESS",
      amount: "150.00",
      categoryId: null,
      note: null,
    });

    await service.create(
      VAULT,
      novaDivida(contact.id, {
        amount: "100.00",
        originTransactionId: compra.id,
        markOriginReimbursable: true,
      }),
    );

    const rateio = splits.filter((s) => s.transactionId === compra.id);
    expect(rateio.map((s) => s.kind).sort()).toEqual(["BUSINESS", "REIMBURSABLE"]);
    expect(personalConsumption(compra.amountBrl, rateio)).toBe("50.00");
  });

  it("recusa quando o rateio não cabe no valor da compra", async () => {
    const { service, contact, addTransaction, debts } = await comPessoa();
    const compra = addTransaction({ direction: "OUT", amount: "100.00", amountBrl: "100.00" });

    await expect(
      service.create(
        VAULT,
        novaDivida(contact.id, {
          amount: "150.00",
          originTransactionId: compra.id,
          markOriginReimbursable: true,
        }),
      ),
    ).rejects.toThrow(/ultrapassa o valor/);

    // E a dívida NÃO nasce pela metade: recusar depois de gravar deixaria um
    // valor a receber sem o reembolsável correspondente.
    expect(debts).toHaveLength(0);
  });

  it("recusa marcar reembolsável numa dívida que eu devo", async () => {
    const { service, contact, addTransaction } = await comPessoa();
    const compra = addTransaction({ direction: "OUT" });

    await expect(
      service.create(
        VAULT,
        novaDivida(contact.id, {
          direction: "I_OWE_THEM",
          originTransactionId: compra.id,
          markOriginReimbursable: true,
        }),
      ),
    ).rejects.toThrow(/a receber/);
  });
});

describe("pessoas", () => {
  it("recusa apagar pessoa que ainda tem dívida, explicando a saída", async () => {
    const { service, contact } = await comPessoa();
    await service.create(VAULT, novaDivida(contact.id));

    await expect(service.deleteContact(VAULT, contact.id)).rejects.toThrow(/desative a pessoa/);
  });

  it("apaga pessoa sem dívida", async () => {
    const { service, contact, contacts } = await comPessoa();
    await service.deleteContact(VAULT, contact.id);
    expect(contacts).toHaveLength(0);
  });
});

describe("edição da dívida", () => {
  it("recusa reduzir o valor abaixo do que já foi devolvido", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    await service.addPayment(VAULT, debt.id, {
      amount: "300.00",
      paidAt: utcDate(2026, 8, 15),
      transactionId: null,
      note: null,
    });

    // Aceitar criaria saldo negativo e inverteria a dívida em silêncio.
    await expect(service.update(VAULT, debt.id, { amount: "200.00" })).rejects.toThrow(
      /menor que o total já baixado/,
    );
  });

  it("aceita aumentar o valor, e o saldo acompanha", async () => {
    const { service, contact } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    await service.addPayment(VAULT, debt.id, {
      amount: "300.00",
      paidAt: utcDate(2026, 8, 15),
      transactionId: null,
      note: null,
    });

    const maior = await service.update(VAULT, debt.id, { amount: "800.00" });
    expect(maior.balance).toBe("500.00");
    expect(maior.status).toBe("PARTIAL");
  });
});

describe("porta DebtLinkChecker", () => {
  it("descreve a dívida que uma movimentação baixa", async () => {
    const { service, contact, addTransaction } = await comPessoa();
    const debt = await service.create(VAULT, novaDivida(contact.id));
    const pix = addTransaction({ direction: "IN" });
    await service.addPayment(VAULT, debt.id, {
      amount: "500.00",
      paidAt: utcDate(2026, 8, 20),
      transactionId: pix.id,
      note: null,
    });

    expect(await service.describeDebtLink(VAULT, pix.id)).toBe(
      "Emprestei pro conserto do carro (Bruno)",
    );
  });

  it("devolve null quando a movimentação não baixa nada", async () => {
    const { service, addTransaction } = await comPessoa();
    const solta = addTransaction({ direction: "IN" });
    expect(await service.describeDebtLink(VAULT, solta.id)).toBeNull();
  });
});
