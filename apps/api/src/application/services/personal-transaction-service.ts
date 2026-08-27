import type {
  PersonalStatement,
  PersonalTransaction,
  PersonalTransactionDetail,
} from "../../domain/entities/personal-finance.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalAccountRepository } from "../../domain/repositories/personal-account-repository.js";
import type { PersonalStatementRepository } from "../../domain/repositories/personal-statement-repository.js";
import type {
  PersonalTransactionRepository,
  SplitInput,
  TransactionFilters,
  UpdateTransactionInput,
} from "../../domain/repositories/personal-transaction-repository.js";
import {
  businessAmount,
  deriveAllocationFlags,
  personalConsumption,
  reimbursableAmount,
  validateSplits,
} from "./split-allocation.js";
import { resolveStatementPeriod, resolveStatementStatus } from "./statement-period.js";
import { normalizeDescription } from "./transaction-text.js";
import { formatMoney, parseMoney } from "./vault-money.js";

/**
 * Movimentações, divisões e faturas.
 *
 * Três invariantes que só existem aqui (o banco garante o formato, não o
 * significado):
 *
 * 1. **Origem única.** Conta OU cartão, e a origem tem que ser deste Cofre. O
 *    CHECK do banco impede os dois/nenhum; só a aplicação sabe checar posse.
 * 2. **Compra no cartão nasce ligada a uma fatura.** A fatura é resolvida pelo
 *    dia de fechamento — não escolhida na tela — porque "em qual fatura isso
 *    caiu" é uma consequência do calendário, não uma opinião.
 * 3. **Total de fatura é sempre recalculado a partir das linhas.** Nunca
 *    incrementado: um acumulador dessincroniza no primeiro estorno e ninguém
 *    percebe até a fatura não bater com o banco.
 */
export interface CreateManualTransactionInput {
  accountId: string | null;
  cardId: string | null;
  transactionDate: Date;
  settlementDate: Date | null;
  description: string;
  merchantId: string | null;
  categoryId: string | null;
  direction: "IN" | "OUT";
  amount: string;
  currency: "BRL" | "USD" | "EUR";
  originalAmount: string | null;
  originalCurrency: "BRL" | "USD" | "EUR" | null;
  /** Obrigatório quando `currency` não é BRL — é a coluna que os relatórios
   *  somam, e converter na leitura reescreveria meses já fechados. */
  amountBrl: string | null;
  note: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  isTransfer: boolean;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  date: Date;
  amount: string;
  description: string;
  note: string | null;
}

export class PersonalTransactionService {
  constructor(
    private readonly transactions: PersonalTransactionRepository,
    private readonly accounts: PersonalAccountRepository,
    private readonly statements: PersonalStatementRepository,
  ) {}

  // ----- Leitura -----

  async list(
    vaultId: string,
    filters: TransactionFilters,
  ): Promise<{ items: PersonalTransactionDetail[]; total: number }> {
    const page = await this.transactions.list(vaultId, filters);
    const splitsByTransaction = await this.transactions.listSplitsFor(
      vaultId,
      page.items.map((item) => item.id),
    );
    return {
      items: page.items.map((item) => toDetail(item, splitsByTransaction.get(item.id) ?? [])),
      total: page.total,
    };
  }

  async get(vaultId: string, id: string): Promise<PersonalTransactionDetail> {
    const transaction = await this.transactions.findById(vaultId, id);
    if (!transaction) throw new NotFoundError("Movimentação não encontrada.");
    const splits = (await this.transactions.listSplitsFor(vaultId, [id])).get(id) ?? [];
    return toDetail(transaction, splits);
  }

  // ----- Escrita -----

  async create(
    vaultId: string,
    input: CreateManualTransactionInput,
  ): Promise<PersonalTransactionDetail> {
    const origin = await this.resolveOrigin(vaultId, input.accountId, input.cardId);
    const amountBrl = this.resolveAmountBrl(input);

    // Compra no cartão já nasce na fatura certa.
    let statementId: string | null = null;
    if (origin.kind === "card") {
      const statement = await this.ensureStatementFor(vaultId, origin.card, input.transactionDate);
      statementId = statement.id;
    }

    const created = await this.transactions.create(vaultId, {
      accountId: input.accountId,
      cardId: input.cardId,
      transactionDate: input.transactionDate,
      settlementDate: input.settlementDate,
      originalDescription: input.description,
      normalizedDescription: normalizeDescription(input.description),
      merchantId: input.merchantId,
      categoryId: input.categoryId,
      direction: input.direction,
      amount: input.amount,
      currency: input.currency,
      originalAmount: input.originalAmount,
      originalCurrency: input.originalCurrency,
      amountBrl,
      source: "MANUAL",
      // Lançamento manual não vem de arquivo nenhum.
      importBatchId: null,
      subscriptionId: null,
      externalId: null,
      // Nulo de propósito: dois lançamentos manuais idênticos no mesmo dia são
      // duas despesas reais, e um fingerprint faria o segundo colidir com o
      // unique de deduplicação.
      fingerprint: null,
      status: "CONFIRMED",
      note: input.note,
      statementId,
      installmentNumber: input.installmentNumber,
      installmentTotal: input.installmentTotal,
      isTransfer: input.isTransfer,
    });

    if (statementId) await this.recalculateStatement(vaultId, statementId);
    return toDetail(created, []);
  }

  async update(
    vaultId: string,
    id: string,
    patch: UpdateTransactionInput,
  ): Promise<PersonalTransactionDetail> {
    const before = await this.transactions.findById(vaultId, id);
    if (!before) throw new NotFoundError("Movimentação não encontrada.");

    const updated = await this.transactions.update(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Movimentação não encontrada.");

    // Mudar status (estorno, por exemplo) muda o total da fatura.
    if (before.statementId) await this.recalculateStatement(vaultId, before.statementId);
    if (updated.statementId && updated.statementId !== before.statementId) {
      await this.recalculateStatement(vaultId, updated.statementId);
    }

    const splits = (await this.transactions.listSplitsFor(vaultId, [id])).get(id) ?? [];
    return toDetail(updated, splits);
  }

  async delete(vaultId: string, id: string): Promise<void> {
    const transaction = await this.transactions.findById(vaultId, id);
    if (!transaction) throw new NotFoundError("Movimentação não encontrada.");

    const deleted = await this.transactions.delete(vaultId, id);
    if (!deleted) throw new NotFoundError("Movimentação não encontrada.");
    if (transaction.statementId) await this.recalculateStatement(vaultId, transaction.statementId);
  }

  /**
   * Substitui o rateio inteiro. Não existe "adicionar uma divisão": rateio pela
   * metade é rateio errado, e a validação da soma só faz sentido sobre o
   * conjunto completo.
   */
  async replaceSplits(
    vaultId: string,
    transactionId: string,
    splits: SplitInput[],
  ): Promise<PersonalTransactionDetail> {
    const transaction = await this.transactions.findById(vaultId, transactionId);
    if (!transaction) throw new NotFoundError("Movimentação não encontrada.");

    const validation = validateSplits(transaction.amountBrl, splits);
    if (!validation.ok) throw new ValidationError(validation.reason);

    const replaced = await this.transactions.replaceSplits(vaultId, transactionId, splits);
    if (!replaced) throw new NotFoundError("Movimentação não encontrada.");

    return this.get(vaultId, transactionId);
  }

  /**
   * Transferência entre contas próprias: DUAS movimentações, uma saída e uma
   * entrada, apontando uma pra outra.
   *
   * Não é uma linha só porque as duas contas precisam do lançamento pra que o
   * extrato de cada uma bata com o banco. E as duas nascem `isTransfer`, que é
   * o que mantém a operação fora dos totais de receita e de despesa — dinheiro
   * trocando de bolso não é ganho nem gasto.
   */
  async createTransfer(
    vaultId: string,
    input: CreateTransferInput,
  ): Promise<{ from: PersonalTransaction; to: PersonalTransaction }> {
    if (input.fromAccountId === input.toAccountId) {
      throw new ValidationError("Origem e destino são a mesma conta.");
    }
    const from = await this.accounts.findAccount(vaultId, input.fromAccountId);
    const to = await this.accounts.findAccount(vaultId, input.toAccountId);
    if (!from || !to)
      throw new ValidationError("Conta de origem ou destino não encontrada neste Cofre.");

    const normalized = normalizeDescription(input.description);
    const common = {
      cardId: null,
      transactionDate: input.date,
      settlementDate: input.date,
      originalDescription: input.description,
      normalizedDescription: normalized,
      merchantId: null,
      categoryId: null,
      amount: input.amount,
      currency: "BRL" as const,
      originalAmount: null,
      originalCurrency: null,
      amountBrl: input.amount,
      source: "MANUAL" as const,
      importBatchId: null,
      subscriptionId: null,
      externalId: null,
      fingerprint: null,
      status: "CONFIRMED" as const,
      note: input.note,
      statementId: null,
      installmentNumber: null,
      installmentTotal: null,
      isTransfer: true,
    };

    const outLeg = await this.transactions.create(vaultId, {
      ...common,
      accountId: input.fromAccountId,
      direction: "OUT",
    });
    const inLeg = await this.transactions.create(vaultId, {
      ...common,
      accountId: input.toAccountId,
      direction: "IN",
    });

    // Ligação nos dois sentidos, numa transação de banco: é ela que permite,
    // mais tarde, mostrar a transferência como uma operação só e não como dois
    // lançamentos soltos.
    await this.transactions.linkTransferPair(vaultId, outLeg.id, inLeg.id);

    return { from: outLeg, to: inLeg };
  }

  // ----- Faturas -----

  listStatements(vaultId: string, cardId?: string): Promise<PersonalStatement[]> {
    return this.statements.list(vaultId, cardId);
  }

  async getStatement(vaultId: string, id: string): Promise<PersonalStatement> {
    const statement = await this.statements.findById(vaultId, id);
    if (!statement) throw new NotFoundError("Fatura não encontrada.");
    return statement;
  }

  /**
   * Pagamento de fatura.
   *
   * Registra o valor pago E cria a saída de caixa na conta pagadora **como
   * transferência**. É o ponto do módulo em que é mais fácil contar duas vezes:
   * a compra no cartão já é a despesa; o pagamento é só o dinheiro saindo da
   * conta. Marcar a saída como `isTransfer` é o que mantém as duas coisas
   * separadas no relatório.
   */
  async payStatement(
    vaultId: string,
    statementId: string,
    input: { amount: string; date: Date; accountId: string | null },
    now = new Date(),
  ): Promise<PersonalStatement> {
    const statement = await this.getStatement(vaultId, statementId);

    const paid = parseMoney(statement.paidAmount) + parseMoney(input.amount);
    if (paid < 0) throw new ValidationError("Pagamento resultaria em valor pago negativo.");

    if (input.accountId) {
      const account = await this.accounts.findAccount(vaultId, input.accountId);
      if (!account) throw new ValidationError("Conta de pagamento não encontrada neste Cofre.");

      const description = "Pagamento de fatura";
      await this.transactions.create(vaultId, {
        accountId: input.accountId,
        cardId: null,
        transactionDate: input.date,
        settlementDate: input.date,
        originalDescription: description,
        normalizedDescription: normalizeDescription(description),
        merchantId: null,
        categoryId: null,
        direction: "OUT",
        amount: input.amount,
        currency: "BRL",
        originalAmount: null,
        originalCurrency: null,
        amountBrl: input.amount,
        source: "MANUAL",
        // Lançamento manual não vem de arquivo nenhum.
        importBatchId: null,
        subscriptionId: null,
        externalId: null,
        fingerprint: null,
        status: "CONFIRMED",
        note: null,
        // Não entra na fatura que está sendo paga: seria somar o pagamento ao
        // total que ele quita.
        statementId: null,
        installmentNumber: null,
        installmentTotal: null,
        isTransfer: true,
      });
    }

    const status = resolveStatementStatus({
      totalCents: parseMoney(statement.totalAmount),
      paidCents: paid,
      closingDate: statement.closingDate,
      dueDate: statement.dueDate,
      today: now,
    });

    const updated = await this.statements.registerPayment(
      vaultId,
      statementId,
      formatMoney(paid),
      status,
    );
    if (!updated) throw new NotFoundError("Fatura não encontrada.");
    return updated;
  }

  /** Recalcula total e status a partir das linhas. Idempotente. */
  async recalculateStatement(
    vaultId: string,
    statementId: string,
    now = new Date(),
  ): Promise<PersonalStatement | null> {
    const statement = await this.statements.findById(vaultId, statementId);
    if (!statement) return null;

    const total = await this.transactions.sumByStatement(vaultId, statementId);
    const updated = await this.statements.updateTotal(vaultId, statementId, total);
    if (!updated) return null;

    const status = resolveStatementStatus({
      totalCents: parseMoney(total),
      paidCents: parseMoney(updated.paidAmount),
      closingDate: updated.closingDate,
      dueDate: updated.dueDate,
      today: now,
    });
    return this.statements.registerPayment(vaultId, statementId, updated.paidAmount, status);
  }

  // ----- Apoio -----

  private async resolveOrigin(
    vaultId: string,
    accountId: string | null,
    cardId: string | null,
  ): Promise<
    { kind: "account" } | { kind: "card"; card: { closingDay: number; dueDay: number; id: string } }
  > {
    if ((accountId === null) === (cardId === null)) {
      throw new ValidationError("Informe exatamente uma origem: conta ou cartão.");
    }

    if (accountId) {
      const account = await this.accounts.findAccount(vaultId, accountId);
      if (!account) throw new ValidationError("Conta não encontrada neste Cofre.");
      return { kind: "account" };
    }

    const card = await this.accounts.findCard(vaultId, cardId!);
    if (!card) throw new ValidationError("Cartão não encontrado neste Cofre.");
    return { kind: "card", card };
  }

  private resolveAmountBrl(input: CreateManualTransactionInput): string {
    if (input.currency === "BRL") return input.amount;
    if (!input.amountBrl) {
      // Sem o valor em reais não dá pra somar nada — e chutar uma conversão
      // aqui produziria um total plausível e errado.
      throw new ValidationError(
        "Informe o valor cobrado em BRL para movimentações em moeda estrangeira.",
      );
    }
    return input.amountBrl;
  }

  private async ensureStatementFor(
    vaultId: string,
    card: { id: string; closingDay: number; dueDay: number },
    purchaseDate: Date,
  ): Promise<PersonalStatement> {
    const period = resolveStatementPeriod({
      purchaseDate,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
    });
    return this.statements.ensureForPeriod(vaultId, { cardId: card.id, ...period });
  }
}

/** Junta a movimentação com o rateio derivado das divisões. */
function toDetail(
  transaction: PersonalTransaction,
  splits: PersonalTransactionDetail["splits"],
): PersonalTransactionDetail {
  const flags = deriveAllocationFlags(splits);
  return {
    ...transaction,
    splits,
    ...flags,
    businessAmount: businessAmount(splits),
    reimbursableAmount: reimbursableAmount(splits),
    personalConsumption: personalConsumption(transaction.amountBrl, splits),
  };
}
