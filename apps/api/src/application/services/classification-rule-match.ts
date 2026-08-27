/**
 * Casamento de regra com movimentação. Determinístico, sem IA.
 *
 * Classificação alimenta relatório e, na fase 7, despesa da empresa. Um
 * palpite errado aqui não gera erro: gera um número plausível. Regra
 * determinística erra sempre do mesmo jeito, e você conserta uma vez.
 *
 * As condições preenchidas combinam com **E** — todas precisam casar. Uma
 * regra sem condição nenhuma não casa com nada (ver `ruleMatches`).
 */

export type RuleMatchType = "CONTAINS" | "STARTS_WITH" | "EXACT";

export interface ClassificationRule {
  id: string;
  /** Menor roda primeiro. */
  priority: number;
  isActive: boolean;

  matchType: RuleMatchType | null;
  /** Já normalizado, igual à descrição da movimentação. */
  matchValue: string | null;
  matchMerchantId: string | null;
  matchAccountId: string | null;
  matchCardId: string | null;
  matchAmountMinCents: number | null;
  matchAmountMaxCents: number | null;

  setMerchantId: string | null;
  setCategoryId: string | null;
  /** Assinatura que a regra vincula à cobrança. */
  setSubscriptionId: string | null;
  /** Percentual da movimentação que é despesa da empresa, como string. */
  businessPercent: string | null;
}

export interface ClassificationSubject {
  normalizedDescription: string;
  accountId: string | null;
  cardId: string | null;
  /** Fornecedor já resolvido, quando houver — permite regra "sobre o Claude". */
  merchantId: string | null;
  amountCents: number;
}

export function ruleMatches(rule: ClassificationRule, subject: ClassificationSubject): boolean {
  if (!rule.isActive) return false;

  // Regra vazia casaria com TODA movimentação e reclassificaria o Cofre
  // inteiro. O service recusa criar uma; esta guarda é redundante de
  // propósito, porque o custo de uma regra vazia escapar é alto demais.
  if (!ruleHasAnyCondition(rule)) return false;

  if (rule.matchType && rule.matchValue && !textMatches(rule, subject.normalizedDescription)) {
    return false;
  }
  if (rule.matchMerchantId && rule.matchMerchantId !== subject.merchantId) return false;
  if (rule.matchAccountId && rule.matchAccountId !== subject.accountId) return false;
  if (rule.matchCardId && rule.matchCardId !== subject.cardId) return false;

  // Faixa inclusiva nas duas pontas: "de 100 a 200" inclui 100 e 200.
  if (rule.matchAmountMinCents !== null && subject.amountCents < rule.matchAmountMinCents) {
    return false;
  }
  if (rule.matchAmountMaxCents !== null && subject.amountCents > rule.matchAmountMaxCents) {
    return false;
  }

  return true;
}

export function ruleHasAnyCondition(rule: ClassificationRule): boolean {
  return (
    (rule.matchType !== null && rule.matchValue !== null) ||
    rule.matchMerchantId !== null ||
    rule.matchAccountId !== null ||
    rule.matchCardId !== null ||
    rule.matchAmountMinCents !== null ||
    rule.matchAmountMaxCents !== null
  );
}

/**
 * Ordena por prioridade, desempatando pelo id.
 *
 * O desempate não é detalhe: sem ele, duas regras de mesma prioridade
 * poderiam ser avaliadas em ordens diferentes entre execuções (a ordem que o
 * banco devolve não é garantida sem `ORDER BY` total), e a mesma movimentação
 * cairia em categorias diferentes em duas rodadas.
 *
 * Não altera o array recebido.
 */
export function sortRulesByPriority(rules: readonly ClassificationRule[]): ClassificationRule[] {
  return [...rules].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
}

function textMatches(rule: ClassificationRule, description: string): boolean {
  const value = rule.matchValue!;
  switch (rule.matchType) {
    case "CONTAINS":
      return description.includes(value);
    case "STARTS_WITH":
      return description.startsWith(value);
    case "EXACT":
      return description === value;
    default:
      return false;
  }
}
