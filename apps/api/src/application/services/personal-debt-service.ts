import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalTransaction } from "../../domain/entities/personal-finance.js";
import type {
  CreateContactInput,
  CreateDebtInput,
  CreatePaymentInput,
  DebtDirection,
  DebtFilters,
  PersonalContact,
  PersonalDebt,
  PersonalDebtRepository,
  UpdateContactInput,
  UpdateDebtInput,
} from "../../domain/repositories/personal-debt-repository.js";
import type { PersonalTransactionRepository } from "../../domain/repositories/personal-transaction-repository.js";
import type { DebtLinkChecker } from "../../domain/services/debt-link-checker.js";
import {
  debtBalance,
  debtOverpayment,
  resolveDebtStatus,
  validatePayment,
  type DebtStatus,
} from "./debt-status.js";
import { validateSplits } from "./split-allocation.js";
import { formatMoney, parseMoney } from "./vault-money.js";

/**
 * Dívidas: quem me deve, pra quem eu devo, e o que já foi devolvido.
 *
 * ## O que este serviço protege
 *
 * Duas contagens duplas, uma em cada ponta:
 *
 * 1. **Na baixa.** O Pix que quita não é renda — a regra vive em
 *    `cash-flow-kind.ts`, e aqui está o que a sustenta: o vínculo só é criado
 *    depois de conferir que a movimentação existe, é do Cofre, aponta pro lado
 *    certo e ainda não baixou outra dívida.
 * 2. **Na origem.** A compra feita pra outra pessoa vira dívida E divisão
 *    reembolsável na mesma operação, então ela sai do consumo pessoal no mesmo
 *    instante em que passa a aparecer como valor a receber. Criar a dívida sem
 *    a divisão deixaria os R$300 do jantar contados como gasto seu enquanto a
 *    tela de dívidas jura que alguém te deve.
 */

export interface DebtPaymentView {
  id: string;
  amount: string;
  paidAt: Date;
  transactionId: string | null;
  note: string | null;
}

export interface DebtView {
  id: string;
  contactId: string;
  contactName: string;
  direction: DebtDirection;
  description: string;
  originalAmount: string;
  /** Soma das baixas — derivada, ver `debt-status.ts`. */
  paidAmount: string;
  /** Quanto ainda falta. Nunca negativo. */
  balance: string;
  /** Devolvido a mais, quando houver. Aparece pra ser resolvido na mão, em vez
   *  de virar crédito silencioso na direção oposta. */
  overpaid: string;
  status: DebtStatus;
  currency: string;
  dueDate: Date | null;
  originTransactionId: string | null;
  canceledAt: Date | null;
  notes: string | null;
  payments: DebtPaymentView[];
  createdAt: Date;
}

export interface DebtSummary {
  /** Soma dos saldos em aberto de quem me deve. */
  aReceber: string;
  /** Soma dos saldos em aberto do que eu devo. */
  aPagar: string;
  atrasadasReceber: number;
  atrasadasPagar: number;
}

export interface CreateDebtRequest {
  contactId: string;
  direction: DebtDirection;
  description: string;
  amount: string;
  currency: "BRL" | "USD" | "EUR";
  dueDate: Date | null;
  originTransactionId: string | null;
  notes: string | null;
  /** Marca a compra de origem como reembolsável no mesmo movimento. Só faz
   *  sentido com `originTransactionId` e direção "alguém me deve". */
  markOriginReimbursable: boolean;
}

export interface AddPaymentRequest {
  amount: string;
  paidAt: Date;
  transactionId: string | null;
  note: string | null;
}

export interface UpdateDebtPatch {
  description?: string;
  amount?: string;
  dueDate?: Date | null;
  notes?: string | null;
  canceled?: boolean;
}

export class PersonalDebtService implements DebtLinkChecker {
  constructor(
    private readonly debts: PersonalDebtRepository,
    private readonly transactions: PersonalTransactionRepository,
  ) {}

  // ----- Pessoas -----

  listContacts(vaultId: string, includeInactive: boolean): Promise<PersonalContact[]> {
    return this.debts.listContacts(vaultId, includeInactive);
  }

  createContact(vaultId: string, input: CreateContactInput): Promise<PersonalContact> {
    return this.debts.createContact(vaultId, input);
  }

  async updateContact(
    vaultId: string,
    id: string,
    patch: UpdateContactInput,
  ): Promise<PersonalContact> {
    const updated = await this.debts.updateContact(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Pessoa não encontrada.");
    return updated;
  }

  /**
   * Apagar pessoa com dívida é recusado antes de o banco recusar.
   *
   * O `ON DELETE RESTRICT` já protegeria o dado, mas o erro subiria como 500 —
   * foi exatamente assim que a exclusão de conta quebrou na fase anterior.
   * Perguntar antes vira um 409 que diz o que fazer.
   */
  async deleteContact(vaultId: string, id: string): Promise<void> {
    const contact = await this.debts.findContactById(vaultId, id);
    if (!contact) throw new NotFoundError("Pessoa não encontrada.");

    const dividas = await this.debts.countDebtsForContact(vaultId, id);
    if (dividas > 0) {
      throw new ConflictError(
        `Esta pessoa tem ${dividas} ${dividas === 1 ? "dívida registrada" : "dívidas registradas"}. ` +
          "Apague as dívidas antes, ou desative a pessoa para tirá-la das listas sem perder o histórico.",
      );
    }

    const deleted = await this.debts.deleteContact(vaultId, id);
    if (!deleted) throw new NotFoundError("Pessoa não encontrada.");
  }

  // ----- Dívidas -----

  async list(vaultId: string, filters: DebtFilters): Promise<DebtView[]> {
    const debts = await this.debts.listDebts(vaultId, filters);
    const hoje = startOfToday();
    return debts.map((d) => toView(d, hoje));
  }

  async get(vaultId: string, id: string): Promise<DebtView> {
    const debt = await this.debts.findDebtById(vaultId, id);
    if (!debt) throw new NotFoundError("Dívida não encontrada.");
    return toView(debt, startOfToday());
  }

  async create(vaultId: string, request: CreateDebtRequest): Promise<DebtView> {
    const contact = await this.debts.findContactById(vaultId, request.contactId);
    if (!contact) throw new NotFoundError("Pessoa não encontrada.");

    const cents = parseMoney(request.amount);
    if (cents <= 0) throw new ValidationError("O valor da dívida precisa ser maior que zero.");

    const origem = request.originTransactionId
      ? await this.requireTransaction(vaultId, request.originTransactionId)
      : null;

    if (request.markOriginReimbursable) {
      if (!origem) {
        throw new ValidationError(
          "Marcar a compra como reembolsável exige informar a movimentação de origem.",
        );
      }
      if (request.direction !== "THEY_OWE_ME") {
        throw new ValidationError(
          "Só faz sentido marcar como reembolsável quando a dívida é a receber — " +
            "é a compra que você fez e alguém vai te devolver.",
        );
      }
      await this.appendReimbursableSplit(vaultId, origem, request.amount);
    }

    const input: CreateDebtInput = {
      contactId: request.contactId,
      direction: request.direction,
      description: request.description,
      originalCents: cents,
      currency: request.currency,
      dueDate: request.dueDate,
      originTransactionId: request.originTransactionId,
      notes: request.notes,
    };
    const created = await this.debts.createDebt(vaultId, input);
    return toView(created, startOfToday());
  }

  async update(vaultId: string, id: string, patch: UpdateDebtPatch): Promise<DebtView> {
    const debt = await this.debts.findDebtById(vaultId, id);
    if (!debt) throw new NotFoundError("Dívida não encontrada.");

    const data: UpdateDebtInput = {
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.canceled !== undefined ? { canceledAt: patch.canceled ? new Date() : null } : {}),
    };

    if (patch.amount !== undefined) {
      const cents = parseMoney(patch.amount);
      const pago = sumPayments(debt);
      // Reduzir o valor abaixo do que já foi devolvido criaria saldo negativo,
      // e a dívida passaria a dever pro lado contrário sem ninguém ter dito
      // isso. Recusar aqui é mais honesto que "corrigir" sozinho.
      if (cents < pago) {
        throw new ValidationError(
          `O novo valor (${formatMoney(cents)}) é menor que o total já baixado (${formatMoney(pago)}). ` +
            "Remova baixas antes de reduzir o valor da dívida.",
        );
      }
      data.originalCents = cents;
    }

    const updated = await this.debts.updateDebt(vaultId, id, data);
    if (!updated) throw new NotFoundError("Dívida não encontrada.");
    return toView(updated, startOfToday());
  }

  async delete(vaultId: string, id: string): Promise<void> {
    const deleted = await this.debts.deleteDebt(vaultId, id);
    if (!deleted) throw new NotFoundError("Dívida não encontrada.");
  }

  async summary(vaultId: string): Promise<DebtSummary> {
    const abertas = await this.debts.listDebts(vaultId, {
      direction: null,
      contactId: null,
      includeCanceled: false,
      includeSettled: false,
    });
    const hoje = startOfToday();

    let aReceber = 0;
    let aPagar = 0;
    let atrasadasReceber = 0;
    let atrasadasPagar = 0;

    for (const debt of abertas) {
      const pago = sumPayments(debt);
      const saldo = debtBalance(debt.originalCents, pago);
      const atrasada =
        resolveDebtStatus({
          originalCents: debt.originalCents,
          paidCents: pago,
          dueDate: debt.dueDate,
          today: hoje,
          canceledAt: debt.canceledAt,
        }) === "OVERDUE";

      if (debt.direction === "THEY_OWE_ME") {
        aReceber += saldo;
        if (atrasada) atrasadasReceber += 1;
      } else {
        aPagar += saldo;
        if (atrasada) atrasadasPagar += 1;
      }
    }

    return {
      aReceber: formatMoney(aReceber),
      aPagar: formatMoney(aPagar),
      atrasadasReceber,
      atrasadasPagar,
    };
  }

  // ----- Baixas -----

  async addPayment(vaultId: string, debtId: string, request: AddPaymentRequest): Promise<DebtView> {
    const debt = await this.debts.findDebtById(vaultId, debtId);
    if (!debt) throw new NotFoundError("Dívida não encontrada.");
    if (debt.canceledAt) throw new ValidationError("Esta dívida foi cancelada.");

    const cents = parseMoney(request.amount);
    const check = validatePayment(debt.originalCents, sumPayments(debt), cents);
    if (!check.ok) throw new ValidationError(check.reason);

    if (request.transactionId) {
      await this.assertCanSettle(vaultId, debt, request.transactionId);
    }

    const input: CreatePaymentInput = {
      amountCents: cents,
      paidAt: request.paidAt,
      transactionId: request.transactionId,
      note: request.note,
    };
    const updated = await this.debts.addPayment(vaultId, debtId, input);
    return toView(updated, startOfToday());
  }

  async deletePayment(vaultId: string, debtId: string, paymentId: string): Promise<DebtView> {
    const removed = await this.debts.deletePayment(vaultId, debtId, paymentId);
    if (!removed) throw new NotFoundError("Baixa não encontrada.");
    return this.get(vaultId, debtId);
  }

  // ----- Porta DebtLinkChecker -----

  async describeDebtLink(vaultId: string, transactionId: string): Promise<string | null> {
    const debt = await this.debts.findDebtByTransaction(vaultId, transactionId);
    return debt ? `${debt.description} (${debt.contactName})` : null;
  }

  // ----- Apoio -----

  private async requireTransaction(
    vaultId: string,
    transactionId: string,
  ): Promise<PersonalTransaction> {
    const tx = await this.transactions.findById(vaultId, transactionId);
    if (!tx) throw new NotFoundError("Movimentação não encontrada.");
    return tx;
  }

  /**
   * A movimentação pode ser a baixa desta dívida?
   *
   * Quatro perguntas, e cada uma existe por um jeito diferente de o número
   * ficar errado:
   *
   * - **Existe e é do Cofre** — o filtro por `vaultId` é o que garante isso,
   *   não a suposição de que só existe um Cofre.
   * - **Direção certa** — dinheiro que alguém me devolve ENTRA; dívida que eu
   *   pago SAI. Trocado, a baixa esconderia uma despesa como se fosse receita.
   * - **Não é transferência** — transferência é entre contas suas, e uma conta
   *   sua não te deve nada.
   * - **Ainda não baixou outra** — o UNIQUE do banco recusaria, mas com um
   *   erro de constraint; a checagem aqui diz qual dívida já usou aquela
   *   movimentação.
   */
  private async assertCanSettle(
    vaultId: string,
    debt: PersonalDebt,
    transactionId: string,
  ): Promise<void> {
    const tx = await this.requireTransaction(vaultId, transactionId);

    const esperada = debt.direction === "THEY_OWE_ME" ? "IN" : "OUT";
    if (tx.direction !== esperada) {
      throw new ValidationError(
        debt.direction === "THEY_OWE_ME"
          ? "Quem te devolve dinheiro gera uma ENTRADA — esta movimentação é uma saída."
          : "Pagar uma dívida sua gera uma SAÍDA — esta movimentação é uma entrada.",
      );
    }

    if (tx.isTransfer) {
      throw new ValidationError(
        "Transferência entre contas suas não baixa dívida — uma conta sua não te deve dinheiro.",
      );
    }

    const jaUsada = await this.debts.findDebtByTransaction(vaultId, transactionId);
    if (jaUsada) {
      throw new ConflictError(
        `Esta movimentação já baixa a dívida "${jaUsada.description}" (${jaUsada.contactName}).`,
      );
    }
  }

  /**
   * Acrescenta a divisão reembolsável **preservando o rateio que já existia**.
   *
   * O repositório só sabe substituir o conjunto inteiro (rateio pela metade é
   * rateio errado), então ler antes e reenviar tudo não é rodeio: é o que
   * impede que criar uma dívida apague em silêncio a divisão empresarial que
   * alguém já tinha lançado naquela compra.
   */
  private async appendReimbursableSplit(
    vaultId: string,
    transaction: PersonalTransaction,
    amount: string,
  ): Promise<void> {
    const atuais = await this.transactions.listSplitsFor(vaultId, [transaction.id]);
    const existentes = (atuais.get(transaction.id) ?? []).map((s) => ({
      kind: s.kind,
      amount: s.amount,
      categoryId: s.categoryId,
      note: s.note,
    }));

    const novo = [
      ...existentes,
      { kind: "REIMBURSABLE" as const, amount, categoryId: null, note: null },
    ];

    const validation = validateSplits(transaction.amountBrl, novo);
    if (!validation.ok) {
      throw new ValidationError(
        `${validation.reason} A dívida não foi criada — ajuste o valor ou o rateio da compra primeiro.`,
      );
    }

    await this.transactions.replaceSplits(vaultId, transaction.id, novo);
  }
}

function sumPayments(debt: PersonalDebt): number {
  return debt.payments.reduce((total, p) => total + p.amountCents, 0);
}

/** Hoje em UTC, à meia-noite — mesma base das datas de calendário do Cofre. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toView(debt: PersonalDebt, today: Date): DebtView {
  const pago = sumPayments(debt);
  return {
    id: debt.id,
    contactId: debt.contactId,
    contactName: debt.contactName,
    direction: debt.direction,
    description: debt.description,
    originalAmount: formatMoney(debt.originalCents),
    paidAmount: formatMoney(pago),
    balance: formatMoney(debtBalance(debt.originalCents, pago)),
    overpaid: formatMoney(debtOverpayment(debt.originalCents, pago)),
    status: resolveDebtStatus({
      originalCents: debt.originalCents,
      paidCents: pago,
      dueDate: debt.dueDate,
      today,
      canceledAt: debt.canceledAt,
    }),
    currency: debt.currency,
    dueDate: debt.dueDate,
    originTransactionId: debt.originTransactionId,
    canceledAt: debt.canceledAt,
    notes: debt.notes,
    payments: debt.payments.map((p) => ({
      id: p.id,
      amount: formatMoney(p.amountCents),
      paidAt: p.paidAt,
      transactionId: p.transactionId,
      note: p.note,
    })),
    createdAt: debt.createdAt,
  };
}
