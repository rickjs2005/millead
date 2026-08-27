import { describe, expect, it } from "vitest";
import {
  classifyTransaction,
  resolveRecurrence,
  type CascadeContext,
} from "./classification-cascade.js";
import type { ClassificationRule, ClassificationSubject } from "./classification-rule-match.js";

const subject: ClassificationSubject = {
  normalizedDescription: "ANTHROPIC CLAUDE",
  accountId: null,
  cardId: "card-1",
  merchantId: null,
  amountCents: 12000,
};

const emptyContext: CascadeContext = {
  externalIdMatch: null,
  rules: [],
  aliasMatch: null,
  subscriptionMatch: null,
  recurrenceMatch: null,
};

const rule = (over: Partial<ClassificationRule> = {}): ClassificationRule => ({
  id: "r1",
  priority: 100,
  isActive: true,
  matchType: "CONTAINS",
  matchValue: "ANTHROPIC",
  matchMerchantId: null,
  matchAccountId: null,
  matchCardId: null,
  matchAmountMinCents: null,
  matchAmountMaxCents: null,
  setMerchantId: null,
  setCategoryId: null,
  businessPercent: null,
  ...over,
});

describe("nada resolve", () => {
  it("sem candidato nenhum, a movimentação vai pra revisão manual", () => {
    const result = classifyTransaction(subject, emptyContext);
    expect(result).toMatchObject({
      merchantId: null,
      categoryId: null,
      businessPercent: null,
      ruleId: null,
      needsReview: true,
    });
    expect(result.resolvedBy).toEqual({});
  });
});

describe("ordem da cascata", () => {
  const externo = { merchantId: "m-externo", categoryId: "c-externo", businessPercent: null };
  const porRegra = rule({ setMerchantId: "m-regra", setCategoryId: "c-regra" });
  const alias = { merchantId: "m-alias", categoryId: "c-alias", businessPercent: null };
  const assinatura = { merchantId: "m-assin", categoryId: "c-assin", businessPercent: null };
  const recorrencia = { merchantId: "m-recor", categoryId: "c-recor", businessPercent: null };

  const cheio: CascadeContext = {
    externalIdMatch: externo,
    rules: [porRegra],
    aliasMatch: alias,
    subscriptionMatch: assinatura,
    recurrenceMatch: recorrencia,
  };

  it("1. identificador externo vence todo o resto", () => {
    const r = classifyTransaction(subject, cheio);
    expect(r.categoryId).toBe("c-externo");
    expect(r.resolvedBy.categoryId).toBe("EXTERNAL_ID");
  });

  it("2. regra do usuário vence alias, assinatura e recorrência", () => {
    const r = classifyTransaction(subject, { ...cheio, externalIdMatch: null });
    expect(r.categoryId).toBe("c-regra");
    expect(r.ruleId).toBe("r1");
    expect(r.resolvedBy.categoryId).toBe("RULE");
  });

  it("3. alias de fornecedor vence assinatura e recorrência", () => {
    const r = classifyTransaction(subject, { ...cheio, externalIdMatch: null, rules: [] });
    expect(r.categoryId).toBe("c-alias");
    expect(r.resolvedBy.categoryId).toBe("MERCHANT_ALIAS");
  });

  it("4. assinatura vence recorrência", () => {
    const r = classifyTransaction(subject, {
      ...cheio,
      externalIdMatch: null,
      rules: [],
      aliasMatch: null,
    });
    expect(r.categoryId).toBe("c-assin");
    expect(r.resolvedBy.categoryId).toBe("SUBSCRIPTION");
  });

  it("5. recorrência é a última antes da revisão manual", () => {
    const r = classifyTransaction(subject, { ...emptyContext, recurrenceMatch: recorrencia });
    expect(r.categoryId).toBe("c-recor");
    expect(r.resolvedBy.categoryId).toBe("RECURRENCE");
  });
});

describe("regras: a primeira que casa, por prioridade", () => {
  it("a mais específica ganha quando tem prioridade menor", () => {
    // "IFOOD ESTACIONAMENTO" -> Transporte precisa vir antes de "IFOOD" ->
    // Delivery, e isso não tem relação com qual foi criada primeiro.
    const especifica = rule({
      id: "especifica",
      priority: 10,
      matchValue: "ANTHROPIC CLAUDE",
      setCategoryId: "c-especifica",
    });
    const generica = rule({ id: "generica", priority: 200, setCategoryId: "c-generica" });

    const r = classifyTransaction(subject, { ...emptyContext, rules: [generica, especifica] });
    expect(r.categoryId).toBe("c-especifica");
    expect(r.ruleId).toBe("especifica");
  });

  it("regra que não casa é ignorada", () => {
    const r = classifyTransaction(subject, {
      ...emptyContext,
      rules: [rule({ matchValue: "OPENAI", setCategoryId: "c-openai" })],
    });
    expect(r.categoryId).toBeNull();
    expect(r.needsReview).toBe(true);
  });
});

describe("preenchimento de lacunas", () => {
  it("um nível preenche só o que o anterior deixou vazio", () => {
    // Regra "tudo neste cartão é 100% empresarial" não diz categoria nenhuma.
    // Sem o preenchimento, ela bloquearia o alias e a movimentação ficaria sem
    // categoria -- pior do que se a regra não existisse.
    const soPercentual = rule({ id: "pct", businessPercent: "100.00" });
    const r = classifyTransaction(subject, {
      ...emptyContext,
      rules: [soPercentual],
      aliasMatch: { merchantId: "m-alias", categoryId: "c-alias", businessPercent: null },
    });

    expect(r.businessPercent).toBe("100.00");
    expect(r.resolvedBy.businessPercent).toBe("RULE");
    expect(r.categoryId).toBe("c-alias");
    expect(r.resolvedBy.categoryId).toBe("MERCHANT_ALIAS");
    expect(r.ruleId).toBe("pct");
  });

  it("nível mais alto nunca é sobrescrito por um mais baixo", () => {
    const r = classifyTransaction(subject, {
      ...emptyContext,
      rules: [rule({ setCategoryId: "c-regra" })],
      recurrenceMatch: { merchantId: null, categoryId: "c-recor", businessPercent: "50.00" },
    });
    expect(r.categoryId).toBe("c-regra");
    // A recorrência ainda preenche o que a regra não disse.
    expect(r.businessPercent).toBe("50.00");
    expect(r.resolvedBy.businessPercent).toBe("RECURRENCE");
  });

  it("só a categoria decide se precisa de revisão", () => {
    // Fornecedor sem categoria ainda é uma movimentação que não entra em
    // relatório nenhum -- continua precisando de revisão.
    const r = classifyTransaction(subject, {
      ...emptyContext,
      aliasMatch: { merchantId: "m-alias", categoryId: null, businessPercent: null },
    });
    expect(r.merchantId).toBe("m-alias");
    expect(r.categoryId).toBeNull();
    expect(r.needsReview).toBe(true);
  });
});

describe("exemplo do Claude, ponta a ponta", () => {
  it("ANTHROPIC vira Claude / Trabalho-IA / 100% empresarial", () => {
    const r = classifyTransaction(subject, {
      ...emptyContext,
      rules: [
        rule({
          id: "claude",
          matchType: "CONTAINS",
          matchValue: "ANTHROPIC",
          setMerchantId: "merchant-claude",
          setCategoryId: "cat-trabalho-ia",
          businessPercent: "100.00",
        }),
      ],
    });

    expect(r).toMatchObject({
      merchantId: "merchant-claude",
      categoryId: "cat-trabalho-ia",
      businessPercent: "100.00",
      ruleId: "claude",
      needsReview: false,
    });
  });
});

describe("resolveRecurrence", () => {
  const group = (categoryId: string | null, merchantId: string | null, count: number) => ({
    categoryId,
    merchantId,
    count,
  });

  it("uma única ocorrência não vira sugestão — coincidência não é padrão", () => {
    expect(resolveRecurrence([group("c-1", "m-1", 1)])).toBeNull();
  });

  it("duas ocorrências iguais viram sugestão", () => {
    expect(resolveRecurrence([group("c-1", "m-1", 2)])).toEqual({
      categoryId: "c-1",
      merchantId: "m-1",
      businessPercent: null,
    });
  });

  it("categorias diferentes NÃO viram voto de maioria", () => {
    // A mesma descrição em duas categorias significa que ela depende de
    // contexto. Escolher a mais frequente classificaria errado com ar de
    // certeza — pior que não classificar.
    expect(resolveRecurrence([group("c-1", "m-1", 9), group("c-2", "m-1", 1)])).toBeNull();
  });

  it("categoria consistente com fornecedores diferentes resolve só a categoria", () => {
    expect(resolveRecurrence([group("c-1", "m-1", 3), group("c-1", "m-2", 2)])).toEqual({
      categoryId: "c-1",
      merchantId: null,
      businessPercent: null,
    });
  });

  it("ocorrências sem categoria são ignoradas na contagem", () => {
    expect(resolveRecurrence([group(null, "m-1", 10), group("c-1", "m-1", 1)])).toBeNull();
  });

  it("histórico vazio devolve null", () => {
    expect(resolveRecurrence([])).toBeNull();
  });
});
