import { describe, expect, it } from "vitest";
import {
  ruleHasAnyCondition,
  ruleMatches,
  sortRulesByPriority,
  type ClassificationRule,
  type ClassificationSubject,
} from "./classification-rule-match.js";

const subject: ClassificationSubject = {
  normalizedDescription: "ANTHROPIC CLAUDE PRO",
  accountId: null,
  cardId: "card-1",
  merchantId: null,
  amountCents: 12000,
};

const rule = (over: Partial<ClassificationRule> = {}): ClassificationRule => ({
  id: "r1",
  priority: 100,
  isActive: true,
  matchType: null,
  matchValue: null,
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

describe("ruleMatches — texto", () => {
  it("CONTAINS casa no meio da descrição", () => {
    expect(ruleMatches(rule({ matchType: "CONTAINS", matchValue: "ANTHROPIC" }), subject)).toBe(
      true,
    );
    expect(ruleMatches(rule({ matchType: "CONTAINS", matchValue: "CLAUDE" }), subject)).toBe(true);
    expect(ruleMatches(rule({ matchType: "CONTAINS", matchValue: "OPENAI" }), subject)).toBe(false);
  });

  it("STARTS_WITH só casa no começo", () => {
    expect(ruleMatches(rule({ matchType: "STARTS_WITH", matchValue: "ANTHROPIC" }), subject)).toBe(
      true,
    );
    expect(ruleMatches(rule({ matchType: "STARTS_WITH", matchValue: "CLAUDE" }), subject)).toBe(
      false,
    );
  });

  it("EXACT exige a descrição inteira", () => {
    expect(
      ruleMatches(rule({ matchType: "EXACT", matchValue: "ANTHROPIC CLAUDE PRO" }), subject),
    ).toBe(true);
    expect(ruleMatches(rule({ matchType: "EXACT", matchValue: "ANTHROPIC" }), subject)).toBe(false);
  });

  it("compara já normalizado dos dois lados", () => {
    // Regra e descrição são gravadas normalizadas. Um texto com acento aqui
    // significa que alguém gravou sem normalizar -- e aí é melhor não casar do
    // que casar por acidente.
    expect(ruleMatches(rule({ matchType: "CONTAINS", matchValue: "anthropic" }), subject)).toBe(
      false,
    );
  });
});

describe("ruleMatches — condições combinam com E", () => {
  it("todas as condições preenchidas precisam casar", () => {
    const r = rule({ matchType: "CONTAINS", matchValue: "ANTHROPIC", matchCardId: "card-1" });
    expect(ruleMatches(r, subject)).toBe(true);
    expect(ruleMatches(r, { ...subject, cardId: "card-2" })).toBe(false);
  });

  it("condição de conta não casa quando a origem é cartão", () => {
    expect(ruleMatches(rule({ matchAccountId: "acc-1" }), subject)).toBe(false);
  });

  it("condição de fornecedor casa com o fornecedor já resolvido", () => {
    expect(ruleMatches(rule({ matchMerchantId: "m-1" }), { ...subject, merchantId: "m-1" })).toBe(
      true,
    );
    expect(ruleMatches(rule({ matchMerchantId: "m-1" }), subject)).toBe(false);
  });
});

describe("ruleMatches — faixa de valor", () => {
  it("é inclusiva nas duas pontas", () => {
    expect(ruleMatches(rule({ matchAmountMinCents: 12000 }), subject)).toBe(true);
    expect(ruleMatches(rule({ matchAmountMaxCents: 12000 }), subject)).toBe(true);
    expect(ruleMatches(rule({ matchAmountMinCents: 12001 }), subject)).toBe(false);
    expect(ruleMatches(rule({ matchAmountMaxCents: 11999 }), subject)).toBe(false);
  });

  it("faixa fechada só casa dentro dela", () => {
    const r = rule({ matchAmountMinCents: 10000, matchAmountMaxCents: 13000 });
    expect(ruleMatches(r, subject)).toBe(true);
    expect(ruleMatches(r, { ...subject, amountCents: 9999 })).toBe(false);
    expect(ruleMatches(r, { ...subject, amountCents: 13001 })).toBe(false);
  });
});

describe("ruleMatches — segurança", () => {
  it("regra sem condição nenhuma NÃO casa com tudo", () => {
    // Uma regra vazia casaria com toda movimentação e reclassificaria o Cofre
    // inteiro. O service recusa criar; aqui a defesa é redundante de propósito.
    expect(ruleMatches(rule(), subject)).toBe(false);
  });

  it("regra inativa nunca casa", () => {
    expect(
      ruleMatches(
        rule({ isActive: false, matchType: "CONTAINS", matchValue: "ANTHROPIC" }),
        subject,
      ),
    ).toBe(false);
  });
});

describe("ruleHasAnyCondition", () => {
  it("reconhece cada condição possível", () => {
    expect(ruleHasAnyCondition(rule())).toBe(false);
    expect(ruleHasAnyCondition(rule({ matchType: "CONTAINS", matchValue: "X" }))).toBe(true);
    expect(ruleHasAnyCondition(rule({ matchMerchantId: "m" }))).toBe(true);
    expect(ruleHasAnyCondition(rule({ matchAccountId: "a" }))).toBe(true);
    expect(ruleHasAnyCondition(rule({ matchCardId: "c" }))).toBe(true);
    expect(ruleHasAnyCondition(rule({ matchAmountMinCents: 1 }))).toBe(true);
    expect(ruleHasAnyCondition(rule({ matchAmountMaxCents: 1 }))).toBe(true);
  });
});

describe("sortRulesByPriority", () => {
  it("menor prioridade primeiro", () => {
    const ordered = sortRulesByPriority([
      rule({ id: "b", priority: 200 }),
      rule({ id: "a", priority: 10 }),
      rule({ id: "c", priority: 100 }),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("empate desempata pelo id — ordem estável entre execuções", () => {
    // Sem desempate, duas regras de mesma prioridade poderiam alternar entre
    // execuções e a mesma movimentação cairia em categorias diferentes.
    const ordered = sortRulesByPriority([
      rule({ id: "z", priority: 5 }),
      rule({ id: "a", priority: 5 }),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["a", "z"]);
  });

  it("não altera o array recebido", () => {
    const input = [rule({ id: "b", priority: 2 }), rule({ id: "a", priority: 1 })];
    sortRulesByPriority(input);
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
