import {
  ruleMatches,
  sortRulesByPriority,
  type ClassificationRule,
  type ClassificationSubject,
} from "./classification-rule-match.js";

/**
 * A cascata de classificação, na ordem combinada:
 *
 * 1. **Identificador externo conhecido** — o mesmo FITID já classificado antes.
 * 2. **Regra sua** — a primeira que casar, por prioridade.
 * 3. **Alias de fornecedor** — ANTHROPIC → Claude → categoria padrão do Claude.
 * 4. **Assinatura cadastrada** — entra na fase 5; hoje chega sempre null.
 * 5. **Recorrência determinística** — a mesma descrição já classificada por
 *    você antes, e sempre da mesma forma.
 * 6. **Revisão manual** — nada resolveu.
 *
 * ## Preenchimento de lacunas
 *
 * Cada nível preenche apenas os campos que os anteriores deixaram vazios, e
 * nunca sobrescreve um nível mais alto.
 *
 * A alternativa — "o primeiro nível que casar decide tudo" — seria mais
 * simples e pior: uma regra do tipo "tudo neste cartão é 100% empresarial"
 * não diz categoria nenhuma, e bloquearia o alias, deixando a movimentação
 * sem categoria. A regra tornaria o resultado PIOR do que se ela não
 * existisse, que é o oposto do que uma regra deve fazer.
 *
 * `resolvedBy` guarda qual nível decidiu cada campo — é o que permite a tela
 * explicar por que a movimentação ficou como ficou.
 */

export type ClassificationLevel =
  "EXTERNAL_ID" | "RULE" | "MERCHANT_ALIAS" | "SUBSCRIPTION" | "RECURRENCE";

export interface ClassificationCandidate {
  merchantId: string | null;
  categoryId: string | null;
  businessPercent: string | null;
}

export interface CascadeContext {
  /** Classificação de uma movimentação anterior com o MESMO identificador externo. */
  externalIdMatch: ClassificationCandidate | null;
  rules: readonly ClassificationRule[];
  /** Fornecedor resolvido por alias, com a categoria padrão dele. */
  aliasMatch: ClassificationCandidate | null;
  /** Fase 5. Hoje sempre null — o parâmetro existe pra a ordem da cascata já
   *  estar certa quando as assinaturas chegarem. */
  subscriptionMatch: ClassificationCandidate | null;
  /** Mesma descrição normalizada, já classificada por você e sempre igual. */
  recurrenceMatch: ClassificationCandidate | null;
}

export type ResolvedBy = Partial<
  Record<"merchantId" | "categoryId" | "businessPercent", ClassificationLevel>
>;

export interface ClassificationOutcome {
  merchantId: string | null;
  categoryId: string | null;
  businessPercent: string | null;
  /** Qual regra casou, quando o nível RULE participou. */
  ruleId: string | null;
  resolvedBy: ResolvedBy;
  /** Sem categoria, a movimentação não entra em relatório nenhum — é isso, e
   *  não a ausência de fornecedor, que manda pra revisão. */
  needsReview: boolean;
}

export function classifyTransaction(
  subject: ClassificationSubject,
  context: CascadeContext,
): ClassificationOutcome {
  const outcome: ClassificationOutcome = {
    merchantId: null,
    categoryId: null,
    businessPercent: null,
    ruleId: null,
    resolvedBy: {},
    needsReview: true,
  };

  apply(outcome, "EXTERNAL_ID", context.externalIdMatch);

  const matched = sortRulesByPriority(context.rules).find((rule) => ruleMatches(rule, subject));
  if (matched) {
    const before = { ...outcome };
    apply(outcome, "RULE", {
      merchantId: matched.setMerchantId,
      categoryId: matched.setCategoryId,
      businessPercent: matched.businessPercent,
    });
    // Só registra a regra se ela realmente contribuiu com algo -- uma regra
    // que casou mas cujos campos já estavam preenchidos por um nível acima
    // não explica nada do resultado.
    if (
      before.merchantId !== outcome.merchantId ||
      before.categoryId !== outcome.categoryId ||
      before.businessPercent !== outcome.businessPercent
    ) {
      outcome.ruleId = matched.id;
    }
  }

  apply(outcome, "MERCHANT_ALIAS", context.aliasMatch);
  apply(outcome, "SUBSCRIPTION", context.subscriptionMatch);
  apply(outcome, "RECURRENCE", context.recurrenceMatch);

  outcome.needsReview = outcome.categoryId === null;
  return outcome;
}

/** Preenche só o que ainda está vazio, anotando quem decidiu. */
function apply(
  outcome: ClassificationOutcome,
  level: ClassificationLevel,
  candidate: ClassificationCandidate | null,
): void {
  if (!candidate) return;

  if (outcome.merchantId === null && candidate.merchantId !== null) {
    outcome.merchantId = candidate.merchantId;
    outcome.resolvedBy.merchantId = level;
  }
  if (outcome.categoryId === null && candidate.categoryId !== null) {
    outcome.categoryId = candidate.categoryId;
    outcome.resolvedBy.categoryId = level;
  }
  if (outcome.businessPercent === null && candidate.businessPercent !== null) {
    outcome.businessPercent = candidate.businessPercent;
    outcome.resolvedBy.businessPercent = level;
  }
}

/** Uma combinação de classificação já usada antes, com quantas vezes. */
export interface ClassificationHistoryGroup {
  categoryId: string | null;
  merchantId: string | null;
  count: number;
}

/**
 * Quantas vezes a mesma descrição precisa ter sido classificada do mesmo jeito
 * pra virar sugestão automática. Duas: uma vez é coincidência, e o custo de
 * errar é uma linha na categoria errada que você corrige na revisão.
 */
export const MIN_RECURRENCE = 2;

/**
 * Recorrência **determinística**: a mesma descrição normalizada já classificada
 * por você antes, e sempre da mesma forma.
 *
 * Ambiguidade não vira voto de maioria. Se a mesma descrição já foi pra duas
 * categorias diferentes, é porque ela realmente depende de contexto (o mesmo
 * "PAG*LOJA" pode ser trabalho ou lazer) -- escolher a mais frequente
 * classificaria errado com ar de certeza. Nesse caso, revisão manual.
 *
 * O fornecedor é resolvido separadamente: a categoria pode ser consistente
 * enquanto o fornecedor não é, e vice-versa.
 */
export function resolveRecurrence(
  groups: readonly ClassificationHistoryGroup[],
  minOccurrences = MIN_RECURRENCE,
): ClassificationCandidate | null {
  const classificados = groups.filter((group) => group.categoryId !== null);
  if (classificados.length === 0) return null;

  const total = classificados.reduce((sum, group) => sum + group.count, 0);
  if (total < minOccurrences) return null;

  const categorias = new Set(classificados.map((group) => group.categoryId));
  if (categorias.size > 1) return null;

  const fornecedores = new Set(classificados.map((group) => group.merchantId));

  return {
    categoryId: classificados[0]!.categoryId,
    // Só quando todas as ocorrências concordam -- e null não conta como
    // concordância, senão uma classificação sem fornecedor "confirmaria" o
    // fornecedor das outras.
    merchantId: fornecedores.size === 1 ? (classificados[0]!.merchantId ?? null) : null,
    businessPercent: null,
  };
}
