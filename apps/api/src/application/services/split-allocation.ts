import { formatMoney, parseMoney, sumMoney } from "./vault-money.js";

/**
 * Rateio de uma movimentação entre pessoal, reembolsável e empresarial.
 *
 * As divisões são a **única** fonte de verdade do rateio. A transação não
 * guarda booleano "é empresarial" nem "é reembolsável": dois lugares dizendo a
 * mesma coisa é exatamente como nasce contagem dupla, que é o risco número um
 * deste módulo. Os indicadores são derivados aqui e expostos pela API já
 * calculados — quem consome não vê diferença; quem grava não tem como
 * dessincronizar.
 *
 * Sem divisão nenhuma, a movimentação é 100% pessoal. Com divisões parciais, o
 * que sobra continua sendo pessoal.
 */

export type SplitKind = "PERSONAL" | "REIMBURSABLE" | "BUSINESS";

export interface SplitAllocation {
  kind: SplitKind;
  /** String decimal, sempre positiva. */
  amount: string;
}

export type SplitValidation =
  { ok: true; personalRemainder: string } | { ok: false; reason: string };

/**
 * A soma das divisões não pode ultrapassar o valor da transação. A comparação é
 * em centavos inteiros, exata: um centavo a mais é recusado, porque em dinheiro
 * "quase igual" é errado.
 */
export function validateSplits(
  transactionAmount: string,
  splits: readonly SplitAllocation[],
): SplitValidation {
  const total = parseMoney(transactionAmount);

  for (const split of splits) {
    if (parseMoney(split.amount) <= 0) {
      return { ok: false, reason: "Cada divisão precisa ter valor maior que zero." };
    }
  }

  const allocated = sumMoney(splits.map((s) => s.amount));
  if (allocated > total) {
    return {
      ok: false,
      reason: `A soma das divisões (${formatMoney(allocated)}) ultrapassa o valor da movimentação (${formatMoney(total)}).`,
    };
  }

  return { ok: true, personalRemainder: formatMoney(total - allocated) };
}

/** Os indicadores que a API expõe — derivados, nunca persistidos. */
export function deriveAllocationFlags(splits: readonly SplitAllocation[]): {
  isBusiness: boolean;
  isReimbursable: boolean;
} {
  return {
    isBusiness: splits.some((s) => s.kind === "BUSINESS"),
    isReimbursable: splits.some((s) => s.kind === "REIMBURSABLE"),
  };
}

/** Quanto desta movimentação é despesa da empresa. */
export function businessAmount(splits: readonly SplitAllocation[]): string {
  return formatMoney(sumMoney(splits.filter((s) => s.kind === "BUSINESS").map((s) => s.amount)));
}

/** Quanto desta movimentação alguém deve devolver. */
export function reimbursableAmount(splits: readonly SplitAllocation[]): string {
  return formatMoney(
    sumMoney(splits.filter((s) => s.kind === "REIMBURSABLE").map((s) => s.amount)),
  );
}

/**
 * Consumo pessoal: o valor menos o que é da empresa e menos o que volta como
 * reembolso.
 *
 * É o número que responde "quanto eu realmente gastei comigo", e é diferente de
 * "quanto saiu da conta" — os R$120 do Claude saem do caixa pessoal mas não são
 * consumo pessoal. Manter os dois indicadores separados é o que evita a
 * conclusão errada de que se gastou mais do que se gastou.
 *
 * Não conhece `isTransfer`: filtrar transferência é responsabilidade de quem
 * monta o relatório, antes de chamar isto.
 */
export function personalConsumption(
  transactionAmount: string,
  splits: readonly SplitAllocation[],
): string {
  const total = parseMoney(transactionAmount);
  const naoPessoal = sumMoney(splits.filter((s) => s.kind !== "PERSONAL").map((s) => s.amount));
  return formatMoney(total - naoPessoal);
}
