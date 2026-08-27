import { beforeEach, describe, expect, it } from "vitest";
import type {
  PersonalCategory,
  PersonalMerchantWithAliases,
  PersonalTransaction,
  PersonalTransactionSplit,
} from "../../domain/entities/personal-finance.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalCatalogRepository } from "../../domain/repositories/personal-catalog-repository.js";
import type {
  CreateRuleInput,
  PersonalRule,
  PersonalRuleRepository,
} from "../../domain/repositories/personal-rule-repository.js";
import type { PersonalSubscriptionRepository } from "../../domain/repositories/personal-subscription-repository.js";
import type {
  PersonalTransactionRepository,
  SplitInput,
} from "../../domain/repositories/personal-transaction-repository.js";
import { PersonalClassificationService } from "./personal-classification-service.js";
import { utcDate } from "./vault-date.js";

const VAULT = "vault-1";
const CAT_IA = "cat-trabalho-ia";
const MERCHANT_CLAUDE = "merchant-claude";

function transaction(over: Partial<PersonalTransaction> = {}): PersonalTransaction {
  return {
    id: "tx-1",
    vaultId: VAULT,
    accountId: null,
    cardId: "card-1",
    transactionDate: utcDate(2026, 8, 5),
    settlementDate: null,
    originalDescription: "Anthropic Claude",
    normalizedDescription: "ANTHROPIC CLAUDE",
    merchantId: null,
    categoryId: null,
    direction: "OUT",
    amount: "120.00",
    currency: "BRL",
    originalAmount: null,
    originalCurrency: null,
    amountBrl: "120.00",
    source: "OFX",
    importBatchId: null,
    subscriptionId: null,
    externalId: null,
    fingerprint: "calc:x",
    status: "PENDING",
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
}

function makeFakes() {
  const rules: PersonalRule[] = [];
  const transactions: PersonalTransaction[] = [transaction()];
  const splits: PersonalTransactionSplit[] = [];
  const categories: PersonalCategory[] = [
    {
      id: CAT_IA,
      vaultId: VAULT,
      parentId: "cat-trabalho",
      name: "IA",
      systemKey: "work.ai",
      color: null,
      sortOrder: 0,
      isActive: true,
    },
  ];
  const merchants: PersonalMerchantWithAliases[] = [
    {
      id: MERCHANT_CLAUDE,
      vaultId: VAULT,
      name: "Claude",
      defaultCategoryId: CAT_IA,
      isActive: true,
      aliases: [{ id: "a1", merchantId: MERCHANT_CLAUDE, alias: "ANTHROPIC CLAUDE" }],
    },
  ];
  let seq = 0;

  const ruleRepo: PersonalRuleRepository = {
    list: async () => rules,
    listActive: async () => rules.filter((r) => r.isActive),
    findById: async (_v, id) => rules.find((r) => r.id === id) ?? null,
    create: async (_v, input: CreateRuleInput) => {
      const created: PersonalRule = { id: `r-${++seq}`, vaultId: VAULT, ...input };
      rules.push(created);
      return created;
    },
    update: async (_v, id, patch) => {
      const found = rules.find((r) => r.id === id);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    delete: async (_v, id) => {
      const i = rules.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rules.splice(i, 1);
      return true;
    },
  };

  const catalog = {
    findCategory: async (_v: string, id: string) => categories.find((c) => c.id === id) ?? null,
    findMerchant: async (_v: string, id: string) => merchants.find((m) => m.id === id) ?? null,
    findMerchantByAlias: async (_v: string, alias: string) =>
      merchants.find((m) => m.aliases.some((a) => a.alias === alias)) ?? null,
  } as unknown as PersonalCatalogRepository;

  const transactionRepo: PersonalTransactionRepository = {
    list: async (_v, filters) => {
      const items = transactions.filter(
        (t) =>
          (!filters.status || t.status === filters.status) &&
          (!filters.importBatchId || t.importBatchId === filters.importBatchId),
      );
      return { items, total: items.length };
    },
    findById: async (_v, id) => transactions.find((t) => t.id === id) ?? null,
    listSplitsFor: async (_v, ids) => {
      const map = new Map<string, PersonalTransactionSplit[]>();
      for (const id of ids) {
        const list = splits.filter((s) => s.transactionId === id);
        if (list.length) map.set(id, list);
      }
      return map;
    },
    create: async () => {
      throw new Error("não usado");
    },
    update: async (_v, id, patch) => {
      const found = transactions.find((t) => t.id === id);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    delete: async () => true,
    linkTransferPair: async () => undefined,
    replaceSplits: async (_v, transactionId, next: SplitInput[]) => {
      for (let i = splits.length - 1; i >= 0; i--) {
        if (splits[i]!.transactionId === transactionId) splits.splice(i, 1);
      }
      next.forEach((s, i) => splits.push({ id: `sp-${i}`, transactionId, ...s }));
      return true;
    },
    createManyFromImport: async () => 0,
    findExistingFingerprints: async () => new Set(),
    findClassificationByExternalId: async () => null,
    listClassificationHistory: async () => [],
    listForPeriod: async () => [],
    listWithBusinessSplits: async () => [],
    sumByStatement: async () => "0",
  };

  // Repositório de assinaturas de mentira: o nível SUBSCRIPTION tem teste
  // próprio no serviço de assinaturas; aqui interessa a cascata sem ele.
  const subscriptionRepo = {
    findActiveByMerchant: async () => null,
  } as unknown as PersonalSubscriptionRepository;

  const service = new PersonalClassificationService(
    ruleRepo,
    catalog,
    transactionRepo,
    subscriptionRepo,
  );
  return { service, rules, transactions, splits, transactionRepo };
}

let f: ReturnType<typeof makeFakes>;
beforeEach(() => {
  f = makeFakes();
});

const regraClaude: CreateRuleInput = {
  name: "Claude",
  priority: 100,
  isActive: true,
  matchType: "CONTAINS",
  matchValue: "anthropic",
  matchMerchantId: null,
  matchAccountId: null,
  matchCardId: null,
  matchAmountMinCents: null,
  matchAmountMaxCents: null,
  setMerchantId: MERCHANT_CLAUDE,
  setCategoryId: CAT_IA,
  setSubscriptionId: null,
  businessPercent: "100.00",
};

describe("criação de regra", () => {
  it("normaliza o texto da condição ao gravar", async () => {
    // A descrição da movimentação é normalizada; a condição precisa ser
    // gravada do mesmo jeito, senão nunca casa.
    const rule = await f.service.createRule(VAULT, regraClaude);
    expect(rule.matchValue).toBe("ANTHROPIC");
  });

  it("recusa regra sem condição — casaria com o Cofre inteiro", async () => {
    await expect(
      f.service.createRule(VAULT, { ...regraClaude, matchType: null, matchValue: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("recusa regra que não faz nada", async () => {
    // Ocuparia uma prioridade e tiraria a movimentação da revisão sem
    // classificar coisa nenhuma.
    await expect(
      f.service.createRule(VAULT, {
        ...regraClaude,
        setCategoryId: null,
        setMerchantId: null,
        businessPercent: null,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("recusa categoria de outro Cofre", async () => {
    await expect(
      f.service.createRule(VAULT, { ...regraClaude, setCategoryId: "cat-de-outro" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("editar não pode transformar a regra numa regra vazia", async () => {
    const rule = await f.service.createRule(VAULT, regraClaude);
    await expect(
      f.service.updateRule(VAULT, rule.id, { matchType: null, matchValue: null }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("apagar regra inexistente é 404", async () => {
    await expect(f.service.deleteRule(VAULT, "nao-existe")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("classificação automática", () => {
  it("o exemplo do Claude: ANTHROPIC vira Claude / Trabalho-IA / 100% empresarial", async () => {
    await f.service.createRule(VAULT, regraClaude);
    const outcome = await f.service.applyTo(VAULT, f.transactions[0]!);

    expect(outcome).toMatchObject({
      merchantId: MERCHANT_CLAUDE,
      categoryId: CAT_IA,
      businessPercent: "100.00",
      needsReview: false,
    });
    expect(f.transactions[0]!.status).toBe("CONFIRMED");
    // Os R$120 viram despesa da empresa — a divisão é o que a fase 7 vai ler.
    expect(f.splits).toEqual([
      {
        id: "sp-0",
        transactionId: "tx-1",
        kind: "BUSINESS",
        amount: "120.00",
        categoryId: null,
        note: null,
      },
    ]);
  });

  it("sem regra, o alias do fornecedor resolve a categoria", async () => {
    const outcome = await f.service.applyTo(VAULT, f.transactions[0]!);
    expect(outcome.resolvedBy.categoryId).toBe("MERCHANT_ALIAS");
    expect(outcome.categoryId).toBe(CAT_IA);
  });

  it("sem regra e sem alias, a movimentação FICA PENDENTE", async () => {
    const desconhecida = transaction({ id: "tx-2", normalizedDescription: "LOJA DESCONHECIDA" });
    f.transactions.push(desconhecida);

    const outcome = await f.service.applyTo(VAULT, desconhecida);

    expect(outcome.needsReview).toBe(true);
    expect(desconhecida.status).toBe("PENDING");
    expect(desconhecida.categoryId).toBeNull();
  });

  it("NÃO sobrescreve divisão que você já fez", async () => {
    // Rateio manual é decisão sua; a classificação automática apagá-lo seria
    // perder trabalho em silêncio.
    f.splits.push({
      id: "meu",
      transactionId: "tx-1",
      kind: "REIMBURSABLE",
      amount: "50.00",
      categoryId: null,
      note: null,
    });
    await f.service.createRule(VAULT, regraClaude);

    await f.service.applyTo(VAULT, f.transactions[0]!);

    expect(f.splits).toHaveLength(1);
    expect(f.splits[0]!.id).toBe("meu");
  });

  it("percentual parcial vira divisão proporcional", async () => {
    await f.service.createRule(VAULT, { ...regraClaude, businessPercent: "50.00" });
    await f.service.applyTo(VAULT, f.transactions[0]!);
    expect(f.splits[0]!.amount).toBe("60.00");
  });

  it("0% não cria divisão de valor zero", async () => {
    await f.service.createRule(VAULT, { ...regraClaude, businessPercent: "0" });
    await f.service.applyTo(VAULT, f.transactions[0]!);
    expect(f.splits).toEqual([]);
  });
});

describe("runPending", () => {
  it("resume quantas foram classificadas e quantas ficaram", async () => {
    f.transactions.push(transaction({ id: "tx-2", normalizedDescription: "LOJA DESCONHECIDA" }));

    const resumo = await f.service.runPending(VAULT, 100);

    expect(resumo).toEqual({ processadas: 2, classificadas: 1, pendentes: 1 });
  });
});

describe("correção manual", () => {
  it("corrige só esta movimentação quando não pede regra", async () => {
    const { rule } = await f.service.correct(VAULT, "tx-1", { categoryId: CAT_IA });

    expect(rule).toBeNull();
    expect(f.rules).toEqual([]);
    expect(f.transactions[0]!.categoryId).toBe(CAT_IA);
    expect(f.transactions[0]!.status).toBe("CONFIRMED");
  });

  it("cria regra para as PRÓXIMAS, sem mexer no passado", async () => {
    const anterior = transaction({ id: "tx-antiga", status: "CONFIRMED", categoryId: "cat-outra" });
    f.transactions.push(anterior);

    const { rule } = await f.service.correct(VAULT, "tx-1", {
      categoryId: CAT_IA,
      merchantId: MERCHANT_CLAUDE,
      createRule: {
        name: "Claude",
        matchType: "CONTAINS",
        matchValue: "anthropic",
        priority: 50,
        scopeToOrigin: false,
      },
    });

    expect(rule).toMatchObject({ matchValue: "ANTHROPIC", setCategoryId: CAT_IA, priority: 50 });
    // A movimentação antiga continua exatamente como estava.
    expect(anterior.categoryId).toBe("cat-outra");
  });

  it("regra com escopo de origem herda a conta/cartão da movimentação", async () => {
    const { rule } = await f.service.correct(VAULT, "tx-1", {
      categoryId: CAT_IA,
      createRule: {
        name: null,
        matchType: "CONTAINS",
        matchValue: "anthropic",
        priority: 100,
        scopeToOrigin: true,
      },
    });

    expect(rule!.matchCardId).toBe("card-1");
    expect(rule!.matchAccountId).toBeNull();
  });

  it("a correção manual SOBRESCREVE a divisão existente — quem pediu foi você", async () => {
    f.splits.push({
      id: "antiga",
      transactionId: "tx-1",
      kind: "BUSINESS",
      amount: "10.00",
      categoryId: null,
      note: null,
    });

    await f.service.correct(VAULT, "tx-1", { categoryId: CAT_IA, businessPercent: "100" });

    expect(f.splits).toHaveLength(1);
    expect(f.splits[0]!.amount).toBe("120.00");
  });

  it("limpar a categoria devolve a movimentação pra revisão", async () => {
    await f.service.correct(VAULT, "tx-1", { categoryId: CAT_IA });
    await f.service.correct(VAULT, "tx-1", { categoryId: null });

    expect(f.transactions[0]!.status).toBe("PENDING");
  });

  it("movimentação inexistente é 404", async () => {
    await expect(
      f.service.correct(VAULT, "nao-existe", { categoryId: CAT_IA }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
