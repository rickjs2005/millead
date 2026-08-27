import type { PersonalTransaction } from "../../domain/entities/personal-finance.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalCatalogRepository } from "../../domain/repositories/personal-catalog-repository.js";
import type {
  CreateRuleInput,
  PersonalRule,
  PersonalRuleRepository,
  UpdateRuleInput,
} from "../../domain/repositories/personal-rule-repository.js";
import type { PersonalSubscriptionRepository } from "../../domain/repositories/personal-subscription-repository.js";
import type {
  PersonalTransactionRepository,
  SplitInput,
} from "../../domain/repositories/personal-transaction-repository.js";
import type {
  ClassifierRunSummary,
  TransactionClassifier,
} from "../../domain/services/transaction-classifier.js";
import {
  classifyTransaction,
  resolveRecurrence,
  type CascadeContext,
  type ClassificationOutcome,
} from "./classification-cascade.js";
import { ruleHasAnyCondition, type ClassificationSubject } from "./classification-rule-match.js";
import { normalizeDescription } from "./transaction-text.js";
import { formatMoney, parseMoney, percentOfMoney } from "./vault-money.js";

/**
 * Classificação automática e regras.
 *
 * **Nenhuma IA participa disto**, por decisão explícita. Classificação
 * alimenta relatório e, na fase 7, despesa da empresa: um palpite errado não
 * gera erro, gera um número plausível. Regra determinística erra sempre do
 * mesmo jeito, e você conserta uma vez — que é exatamente o fluxo de
 * "corrigir esta / criar regra para as próximas".
 *
 * A ordem da cascata mora em `classification-cascade.ts` (pura e testada);
 * aqui fica o que precisa de banco: buscar os candidatos de cada nível,
 * gravar o resultado e materializar o percentual empresarial como divisão.
 */

export interface CorrectClassificationInput {
  merchantId?: string | null;
  categoryId?: string | null;
  businessPercent?: string | null;
  /** Vincula a cobrança a uma assinatura. */
  subscriptionId?: string | null;
  /** Quando presente, cria uma regra para as PRÓXIMAS movimentações. Não
   *  reclassifica o passado — "criar regra para as próximas" é literal. */
  createRule?: {
    name: string | null;
    matchType: "CONTAINS" | "STARTS_WITH" | "EXACT";
    /** Texto cru; é normalizado aqui. */
    matchValue: string;
    priority: number;
    /** Amarra a regra à origem desta movimentação. */
    scopeToOrigin: boolean;
  } | null;
}

export interface ClassificationRunSummary {
  processadas: number;
  classificadas: number;
  pendentes: number;
}

export class PersonalClassificationService implements TransactionClassifier {
  constructor(
    private readonly rules: PersonalRuleRepository,
    private readonly catalog: PersonalCatalogRepository,
    private readonly transactions: PersonalTransactionRepository,
    private readonly subscriptions: PersonalSubscriptionRepository,
  ) {}

  // ----- Regras -----

  list(vaultId: string, includeInactive: boolean): Promise<PersonalRule[]> {
    return this.rules.list(vaultId, includeInactive);
  }

  async createRule(vaultId: string, input: CreateRuleInput): Promise<PersonalRule> {
    await this.assertRule(vaultId, input);
    return this.rules.create(vaultId, normalizeRule(input));
  }

  async updateRule(vaultId: string, id: string, patch: UpdateRuleInput): Promise<PersonalRule> {
    const current = await this.rules.findById(vaultId, id);
    if (!current) throw new NotFoundError("Regra não encontrada.");

    // Valida o resultado da mesclagem, não só o patch: desligar a única
    // condição de uma regra a transformaria numa regra vazia, que casaria com
    // toda movimentação do Cofre.
    await this.assertRule(vaultId, { ...current, ...patch });

    const updated = await this.rules.update(vaultId, id, normalizeRule(patch));
    if (!updated) throw new NotFoundError("Regra não encontrada.");
    return updated;
  }

  async deleteRule(vaultId: string, id: string): Promise<void> {
    const deleted = await this.rules.delete(vaultId, id);
    if (!deleted) throw new NotFoundError("Regra não encontrada.");
  }

  // ----- Classificação -----

  /**
   * Resolve a classificação de uma movimentação sem gravar nada. É o que a
   * pré-visualização da importação usa, e o que `applyTo` chama antes de
   * escrever.
   */
  async resolve(
    vaultId: string,
    transaction: Pick<
      PersonalTransaction,
      | "id"
      | "accountId"
      | "cardId"
      | "normalizedDescription"
      | "externalId"
      | "amountBrl"
      | "merchantId"
      | "subscriptionId"
    >,
  ): Promise<ClassificationOutcome> {
    const origin = { accountId: transaction.accountId, cardId: transaction.cardId };

    const [externalIdMatch, rules, aliasMerchant, history] = await Promise.all([
      transaction.externalId
        ? this.transactions.findClassificationByExternalId(vaultId, origin, transaction.externalId)
        : Promise.resolve(null),
      this.rules.listActive(vaultId),
      this.catalog.findMerchantByAlias(vaultId, transaction.normalizedDescription),
      this.transactions.listClassificationHistory(
        vaultId,
        transaction.normalizedDescription,
        transaction.id,
      ),
    ]);

    // O alias casa com a descrição INTEIRA normalizada. Casar por "contém"
    // aqui invadiria o território das regras — e sem prioridade, dois aliases
    // parciais poderiam casar com a mesma linha em ordem indefinida.
    const aliasMatch = aliasMerchant
      ? {
          merchantId: aliasMerchant.id,
          categoryId: aliasMerchant.defaultCategoryId,
          businessPercent: null,
        }
      : null;

    // Nível 4: assinatura já cadastrada daquele fornecedor. Depende do
    // fornecedor ter sido resolvido antes (por alias ou já gravado) -- sem
    // fornecedor não há como amarrar a cobrança a uma assinatura sem adivinhar
    // pela descrição, que é justamente o trabalho das regras.
    const merchantId = transaction.merchantId ?? aliasMatch?.merchantId ?? null;
    const subscription = merchantId
      ? await this.subscriptions.findActiveByMerchant(vaultId, merchantId)
      : null;

    const context: CascadeContext = {
      externalIdMatch: externalIdMatch ? { ...externalIdMatch, businessPercent: null } : null,
      rules,
      aliasMatch,
      subscriptionMatch: subscription
        ? {
            merchantId: subscription.merchantId,
            categoryId: subscription.categoryId,
            businessPercent: null,
            subscriptionId: subscription.id,
          }
        : null,
      recurrenceMatch: resolveRecurrence(history),
    };

    const subject: ClassificationSubject = {
      normalizedDescription: transaction.normalizedDescription,
      accountId: transaction.accountId,
      cardId: transaction.cardId,
      merchantId,
      amountCents: parseMoney(transaction.amountBrl),
    };

    return classifyTransaction(subject, context);
  }

  /** Resolve e grava. Devolve o resultado aplicado. */
  async applyTo(vaultId: string, transaction: PersonalTransaction): Promise<ClassificationOutcome> {
    const outcome = await this.resolve(vaultId, transaction);

    await this.transactions.update(vaultId, transaction.id, {
      merchantId: outcome.merchantId ?? transaction.merchantId,
      categoryId: outcome.categoryId ?? transaction.categoryId,
      subscriptionId: outcome.subscriptionId ?? transaction.subscriptionId,
      // Classificada sai de pendente; sem categoria, continua esperando você.
      status: outcome.needsReview ? "PENDING" : "CONFIRMED",
    });

    await this.applyBusinessPercent(vaultId, transaction, outcome.businessPercent);
    return outcome;
  }

  /** Passa a cascata nas movimentações que ainda estão pendentes. */
  runPending(vaultId: string, limit: number): Promise<ClassificationRunSummary> {
    return this.run(vaultId, { pageSize: limit });
  }

  /** Passa a cascata só no que um lote de importação acabou de gravar. */
  runForBatch(vaultId: string, importBatchId: string): Promise<ClassifierRunSummary> {
    // pageSize alto de propósito: um lote é finito e acabou de ser inserido;
    // deixar linhas de fora faria a importação terminar com pendências que
    // ninguém pediu pra revisar.
    return this.run(vaultId, { importBatchId, pageSize: 5000 });
  }

  private async run(
    vaultId: string,
    options: { importBatchId?: string; pageSize: number },
  ): Promise<ClassificationRunSummary> {
    const page = await this.transactions.list(vaultId, {
      basis: "ACCRUAL",
      status: "PENDING",
      includeTransfers: true,
      ...(options.importBatchId ? { importBatchId: options.importBatchId } : {}),
      page: 1,
      pageSize: options.pageSize,
    });

    let classificadas = 0;
    for (const transaction of page.items) {
      const outcome = await this.applyTo(vaultId, transaction);
      if (!outcome.needsReview) classificadas++;
    }

    return {
      processadas: page.items.length,
      classificadas,
      pendentes: page.items.length - classificadas,
    };
  }

  /**
   * Correção manual, com a escolha de criar ou não uma regra.
   *
   * Criar a regra **não** reclassifica o passado. "Criar regra para as
   * próximas movimentações" é literal: mexer retroativamente em lançamentos
   * que você já revisou desfaria decisões suas sem pedir.
   */
  async correct(
    vaultId: string,
    transactionId: string,
    input: CorrectClassificationInput,
  ): Promise<{ transaction: PersonalTransaction; rule: PersonalRule | null }> {
    const transaction = await this.transactions.findById(vaultId, transactionId);
    if (!transaction) throw new NotFoundError("Movimentação não encontrada.");

    if (input.categoryId) await this.assertCategory(vaultId, input.categoryId);
    if (input.merchantId) await this.assertMerchant(vaultId, input.merchantId);

    const categoryId = input.categoryId !== undefined ? input.categoryId : transaction.categoryId;
    const updated = await this.transactions.update(vaultId, transactionId, {
      ...(input.merchantId !== undefined ? { merchantId: input.merchantId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.subscriptionId !== undefined ? { subscriptionId: input.subscriptionId } : {}),
      // Você revisou: sai de pendente. Sem categoria, continua pendente.
      status: categoryId ? "CONFIRMED" : "PENDING",
    });
    if (!updated) throw new NotFoundError("Movimentação não encontrada.");

    if (input.businessPercent !== undefined) {
      await this.applyBusinessPercent(vaultId, transaction, input.businessPercent, true);
    }

    let rule: PersonalRule | null = null;
    if (input.createRule) {
      rule = await this.createRule(vaultId, {
        name: input.createRule.name,
        priority: input.createRule.priority,
        isActive: true,
        matchType: input.createRule.matchType,
        matchValue: input.createRule.matchValue,
        matchMerchantId: null,
        matchAccountId: input.createRule.scopeToOrigin ? transaction.accountId : null,
        matchCardId: input.createRule.scopeToOrigin ? transaction.cardId : null,
        matchAmountMinCents: null,
        matchAmountMaxCents: null,
        setMerchantId: input.merchantId ?? null,
        setCategoryId: input.categoryId ?? null,
        setSubscriptionId: input.subscriptionId ?? null,
        businessPercent: input.businessPercent ?? null,
      });
    }

    return { transaction: updated, rule };
  }

  // ----- Apoio -----

  /**
   * Materializa o percentual empresarial como uma divisão BUSINESS.
   *
   * A classificação automática **não toca em divisões que você já fez**: se a
   * movimentação já tem rateio, ele é decisão sua e sobrescrevê-lo apagaria
   * trabalho manual em silêncio. A correção manual (`force`) sobrescreve,
   * porque aí quem pediu foi você.
   */
  private async applyBusinessPercent(
    vaultId: string,
    transaction: PersonalTransaction,
    businessPercent: string | null | undefined,
    force = false,
  ): Promise<void> {
    if (businessPercent === undefined) return;

    if (!force) {
      const existing = (await this.transactions.listSplitsFor(vaultId, [transaction.id])).get(
        transaction.id,
      );
      if (existing && existing.length > 0) return;
    }

    if (businessPercent === null) {
      if (force) await this.transactions.replaceSplits(vaultId, transaction.id, []);
      return;
    }

    const cents = percentOfMoney(parseMoney(transaction.amountBrl), businessPercent);
    // 0% não é uma divisão de valor zero: é a ausência de divisão.
    const splits: SplitInput[] =
      cents > 0
        ? [{ kind: "BUSINESS", amount: formatMoney(cents), categoryId: null, note: null }]
        : [];
    await this.transactions.replaceSplits(vaultId, transaction.id, splits);
  }

  private async assertRule(vaultId: string, rule: Partial<CreateRuleInput>): Promise<void> {
    const candidate = {
      id: "novo",
      priority: rule.priority ?? 100,
      isActive: rule.isActive ?? true,
      matchType: rule.matchType ?? null,
      matchValue: rule.matchValue ? normalizeDescription(rule.matchValue) : null,
      matchMerchantId: rule.matchMerchantId ?? null,
      matchAccountId: rule.matchAccountId ?? null,
      matchCardId: rule.matchCardId ?? null,
      matchAmountMinCents: rule.matchAmountMinCents ?? null,
      matchAmountMaxCents: rule.matchAmountMaxCents ?? null,
      setMerchantId: rule.setMerchantId ?? null,
      setCategoryId: rule.setCategoryId ?? null,
      setSubscriptionId: rule.setSubscriptionId ?? null,
      businessPercent: rule.businessPercent ?? null,
    };

    if (!ruleHasAnyCondition(candidate)) {
      throw new ValidationError(
        "A regra precisa de pelo menos uma condição — uma regra sem condição casaria com todas as movimentações do Cofre.",
      );
    }

    // Regra que não faz nada é pior que não existir: ela ocupa uma prioridade
    // e some com a movimentação da revisão sem classificar coisa nenhuma.
    if (
      !candidate.setCategoryId &&
      !candidate.setMerchantId &&
      candidate.businessPercent === null
    ) {
      throw new ValidationError(
        "A regra precisa definir ao menos uma ação: categoria, fornecedor ou percentual empresarial.",
      );
    }

    if (candidate.setCategoryId) await this.assertCategory(vaultId, candidate.setCategoryId);
    if (candidate.setMerchantId) await this.assertMerchant(vaultId, candidate.setMerchantId);
    if (candidate.matchMerchantId) await this.assertMerchant(vaultId, candidate.matchMerchantId);
  }

  private async assertCategory(vaultId: string, categoryId: string): Promise<void> {
    const category = await this.catalog.findCategory(vaultId, categoryId);
    if (!category) throw new ValidationError("Categoria não encontrada neste Cofre.");
  }

  private async assertMerchant(vaultId: string, merchantId: string): Promise<void> {
    const merchant = await this.catalog.findMerchant(vaultId, merchantId);
    if (!merchant) throw new ValidationError("Fornecedor não encontrado neste Cofre.");
  }
}

/** O texto da condição é gravado normalizado — ver `classification-rule-match`. */
function normalizeRule<T extends { matchValue?: string | null }>(input: T): T {
  return input.matchValue
    ? { ...input, matchValue: normalizeDescription(input.matchValue) }
    : input;
}
