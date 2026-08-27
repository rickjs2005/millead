import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalTransaction } from "../../domain/entities/personal-finance.js";
import type {
  BusinessExpense,
  BusinessExpenseRepository,
  CostCategory,
} from "../../domain/repositories/business-expense-repository.js";
import type { PersonalTransactionRepository } from "../../domain/repositories/personal-transaction-repository.js";
import type { BusinessLinkChecker } from "../../domain/services/business-link-checker.js";
import { businessAmount } from "./split-allocation.js";
import { formatMoney, parseMoney } from "./vault-money.js";

/**
 * A ponte: a parte empresarial de uma compra pessoal virando despesa da MilWeb.
 *
 * ## O que atravessa
 *
 * Valor, data, categoria, plano (opcional) e **a descrição que a pessoa
 * escreve**. A descrição é obrigatória de propósito: a alternativa seria
 * copiar `originalDescription`, e aí a linha crua do banco — com o nome do
 * estabelecimento e o formato do extrato — apareceria no financeiro da
 * empresa sem ninguém ter decidido isso. Quem manda escolhe o que manda.
 *
 * Não atravessa: o id da movimentação, a conta, o cartão, a fatura, e as
 * outras divisões daquela compra. A `BusinessExpense` não tem coluna nenhuma
 * apontando pro Cofre — quem guarda o elo é a `PersonalBusinessAllocation`, e
 * só este serviço a lê.
 *
 * ## Só a parte empresarial
 *
 * O valor enviado é a **soma das divisões BUSINESS**, nunca o valor da compra.
 * Mandar os R$300 do jantar quando só R$100 é da empresa cobraria da MilWeb
 * um dinheiro que ela não deve — e o número seria plausível o bastante pra
 * passar despercebido no fechamento do mês.
 *
 * ## Enviar duas vezes não dobra nada
 *
 * O elo tem UNIQUE na movimentação. Um segundo envio da mesma compra é
 * recusado com 409; se o rateio mudou desde então, o caminho é **sincronizar**
 * (atualiza o valor lá) ou **desfazer** — nunca somar um segundo lançamento.
 */

export type BridgeState = "NAO_ENVIADA" | "ENVIADA" | "DESATUALIZADA";

export interface BridgeItem {
  transactionId: string;
  transactionDate: Date;
  /** A descrição do extrato — visível só aqui, dentro do Cofre. */
  originalDescription: string;
  /** Valor total da compra, pra contexto. Não é o que vai pro financeiro. */
  amountBrl: string;
  /** A parte que é da empresa hoje. É isto que vai. */
  businessAmount: string;
  state: BridgeState;
  /** Preenchidos quando já foi enviada. */
  expenseId: string | null;
  sentAmount: string | null;
  sentDescription: string | null;
  organizationId: string | null;
}

export interface PushRequest {
  description: string;
  category: CostCategory;
  costSubscriptionId: string | null;
  companyId: string | null;
  notes: string | null;
}

export class PersonalBridgeService implements BusinessLinkChecker {
  constructor(
    private readonly expenses: BusinessExpenseRepository,
    private readonly transactions: PersonalTransactionRepository,
  ) {}

  /** As compras com parte empresarial e o estado de cada uma na ponte. */
  async list(
    vaultId: string,
    range: { from: Date | null; to: Date | null },
  ): Promise<BridgeItem[]> {
    const [compras, elos] = await Promise.all([
      this.transactions.listWithBusinessSplits(vaultId, range),
      this.expenses.listAllocations(vaultId),
    ]);

    const elosPorTransacao = new Map(elos.map((a) => [a.transactionId, a]));
    // Uma consulta só pras despesas de todos os elos: o alternativo é uma por
    // linha, e a tela lista dezenas.
    const despesas = new Map<string, BusinessExpense>();
    for (const elo of elos) {
      const despesa = await this.expenses.findById(elo.organizationId, elo.businessExpenseId);
      if (despesa) despesas.set(elo.businessExpenseId, despesa);
    }

    return compras.map(({ transaction, businessAmount: atual }) => {
      const elo = elosPorTransacao.get(transaction.id);
      if (!elo) return this.item(transaction, atual, "NAO_ENVIADA", null, null);

      const despesa = despesas.get(elo.businessExpenseId) ?? null;
      const iguais = parseMoney(elo.amount) === parseMoney(atual);
      return this.item(
        transaction,
        atual,
        iguais ? "ENVIADA" : "DESATUALIZADA",
        elo.amount,
        despesa,
        elo.organizationId,
      );
    });
  }

  async status(vaultId: string, transactionId: string): Promise<BridgeItem> {
    const transaction = await this.requireTransaction(vaultId, transactionId);
    const atual = await this.currentBusinessAmount(vaultId, transaction);
    const elo = await this.expenses.findAllocationByTransaction(vaultId, transactionId);

    if (!elo) return this.item(transaction, atual, "NAO_ENVIADA", null, null);

    const despesa = await this.expenses.findById(elo.organizationId, elo.businessExpenseId);
    const iguais = parseMoney(elo.amount) === parseMoney(atual);
    return this.item(
      transaction,
      atual,
      iguais ? "ENVIADA" : "DESATUALIZADA",
      elo.amount,
      despesa,
      elo.organizationId,
    );
  }

  async push(
    vaultId: string,
    organizationId: string,
    transactionId: string,
    request: PushRequest,
  ): Promise<BridgeItem> {
    const transaction = await this.requireTransaction(vaultId, transactionId);
    const valor = await this.requireBusinessPortion(vaultId, transaction);
    await this.assertPlanBelongsToOrg(organizationId, request.costSubscriptionId);

    const jaEnviada = await this.expenses.findAllocationByTransaction(vaultId, transactionId);
    if (jaEnviada) {
      throw new ConflictError(
        `Esta compra já virou despesa da MilWeb (${formatMoney(parseMoney(jaEnviada.amount))}). ` +
          "Se o rateio mudou, sincronize em vez de enviar de novo — enviar duas vezes dobraria o custo.",
      );
    }

    const { expense } = await this.expenses.createWithAllocation(
      organizationId,
      vaultId,
      transactionId,
      {
        description: request.description,
        amount: valor,
        // Sempre BRL: o Cofre já sabe o que de fato saiu em reais, com IOF e
        // spread do dia. Converter de novo pela cotação de hoje reescreveria
        // o passado a cada oscilação do dólar.
        currency: "BRL",
        incurredAt: transaction.transactionDate,
        category: request.category,
        costSubscriptionId: request.costSubscriptionId,
        companyId: request.companyId,
        source: "PERSONAL_VAULT",
        notes: request.notes,
      },
    );

    return this.item(transaction, valor, "ENVIADA", valor, expense, organizationId);
  }

  /**
   * Alinha o valor lá com o rateio de cá.
   *
   * Existe como ação explícita, e não como correção automática na leitura,
   * porque reescrever a contabilidade da empresa sem ninguém pedir é pior que
   * mostrar a diferença: o mês pode já ter sido fechado com o número antigo, e
   * quem fechou precisa saber que ele mudou.
   */
  async sync(vaultId: string, transactionId: string): Promise<BridgeItem> {
    const transaction = await this.requireTransaction(vaultId, transactionId);
    const elo = await this.expenses.findAllocationByTransaction(vaultId, transactionId);
    if (!elo) throw new NotFoundError("Esta compra ainda não foi enviada para o financeiro.");

    const valor = await this.requireBusinessPortion(vaultId, transaction);
    const resultado = await this.expenses.syncAllocation(vaultId, transactionId, valor, {
      incurredAt: transaction.transactionDate,
    });
    if (!resultado) throw new NotFoundError("Esta compra ainda não foi enviada para o financeiro.");

    return this.item(transaction, valor, "ENVIADA", valor, resultado.expense, elo.organizationId);
  }

  /** Desfaz o envio: a despesa some do financeiro e a compra volta a "não
   *  enviada". O rateio pessoal não é tocado. */
  async revert(vaultId: string, transactionId: string): Promise<BridgeItem> {
    const transaction = await this.requireTransaction(vaultId, transactionId);
    const desfeito = await this.expenses.revertAllocation(vaultId, transactionId);
    if (!desfeito) throw new NotFoundError("Esta compra não tem envio para desfazer.");

    const atual = await this.currentBusinessAmount(vaultId, transaction);
    return this.item(transaction, atual, "NAO_ENVIADA", null, null);
  }

  // ----- Porta BusinessLinkChecker -----

  async describeBusinessLink(vaultId: string, transactionId: string): Promise<string | null> {
    const elo = await this.expenses.findAllocationByTransaction(vaultId, transactionId);
    if (!elo) return null;
    const despesa = await this.expenses.findById(elo.organizationId, elo.businessExpenseId);
    return despesa
      ? `${despesa.description} (${formatMoney(parseMoney(despesa.amount))})`
      : `despesa de ${formatMoney(parseMoney(elo.amount))}`;
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

  private async currentBusinessAmount(
    vaultId: string,
    transaction: PersonalTransaction,
  ): Promise<string> {
    const mapa = await this.transactions.listSplitsFor(vaultId, [transaction.id]);
    return businessAmount(mapa.get(transaction.id) ?? []);
  }

  private async requireBusinessPortion(
    vaultId: string,
    transaction: PersonalTransaction,
  ): Promise<string> {
    if (transaction.status === "REVERSED") {
      throw new ValidationError(
        "Compra estornada não vira despesa da empresa — ninguém pagou por ela.",
      );
    }
    if (transaction.direction === "IN") {
      throw new ValidationError("Só uma saída vira despesa da empresa.");
    }

    const valor = await this.currentBusinessAmount(vaultId, transaction);
    if (parseMoney(valor) <= 0) {
      throw new ValidationError(
        "Esta compra não tem parte empresarial. Marque quanto é da MilWeb no rateio primeiro.",
      );
    }
    return valor;
  }

  /**
   * O plano é desta organização?
   *
   * Não existe FK entre o Cofre e o mundo multi-tenant, então nada no banco
   * impede apontar uma despesa pra um plano de outra organização. Esta é a
   * checagem que faz esse papel.
   */
  private async assertPlanBelongsToOrg(
    organizationId: string,
    costSubscriptionId: string | null,
  ): Promise<void> {
    if (!costSubscriptionId) return;
    const existe = await this.expenses.costSubscriptionExists(organizationId, costSubscriptionId);
    if (!existe) {
      throw new ValidationError("Assinatura de custo não encontrada nesta organização.");
    }
  }

  private item(
    transaction: PersonalTransaction,
    atual: string,
    state: BridgeState,
    sentAmount: string | null,
    expense: BusinessExpense | null,
    organizationId: string | null = null,
  ): BridgeItem {
    return {
      transactionId: transaction.id,
      transactionDate: transaction.transactionDate,
      originalDescription: transaction.originalDescription,
      amountBrl: transaction.amountBrl,
      businessAmount: atual,
      state,
      expenseId: expense?.id ?? null,
      sentAmount,
      sentDescription: expense?.description ?? null,
      organizationId,
    };
  }
}
