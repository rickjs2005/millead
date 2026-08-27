/**
 * Estado de uma dívida: saldo e status.
 *
 * Nada disso é coluna no banco. Tudo sai das baixas mais a data de hoje — o
 * porquê está no comentário do model `PersonalDebt`, mas o resumo é: uma
 * dívida vira **atrasada pela passagem do tempo**, sem que ninguém escreva
 * nada. Uma coluna `status` estaria errada toda madrugada e só voltaria a
 * ficar certa quando alguém mexesse na linha — mentindo justamente nas
 * dívidas esquecidas, que são as que mais importam.
 *
 * Centavos inteiros em toda a fronteira, como no resto do Cofre: comparar
 * dinheiro em ponto flutuante é como um pagamento de R$300,00 vira "quase
 * quitado".
 */

export type DebtStatus = "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELED";

export interface DebtStatusInput {
  originalCents: number;
  paidCents: number;
  /** Nulo quando a dívida não tem prazo — aí ela nunca atrasa. */
  dueDate: Date | null;
  today: Date;
  canceledAt: Date | null;
}

/**
 * Quanto ainda falta. Nunca negativo: quem devolveu a mais não passa a ter
 * crédito automático, porque isso seria inventar uma segunda dívida na direção
 * oposta sem ninguém ter dito que ela existe. O excedente aparece como
 * `overpaidCents`, pra que dê pra ver e resolver na mão.
 */
export function debtBalance(originalCents: number, paidCents: number): number {
  return Math.max(0, originalCents - paidCents);
}

export function debtOverpayment(originalCents: number, paidCents: number): number {
  return Math.max(0, paidCents - originalCents);
}

export function resolveDebtStatus(input: DebtStatusInput): DebtStatus {
  const { originalCents, paidCents, dueDate, today, canceledAt } = input;

  // Cancelada vence tudo, inclusive vencimento passado: uma dívida perdoada
  // não fica atrasada pra sempre na tela.
  if (canceledAt) return "CANCELED";

  // Quitada vem antes de atrasada pelo mesmo motivo — pagou fora do prazo
  // continua sendo pagou.
  if (paidCents >= originalCents) return "PAID";

  if (dueDate && today.getTime() > dueDate.getTime()) return "OVERDUE";

  return paidCents > 0 ? "PARTIAL" : "OPEN";
}

/**
 * Uma baixa cabe? A soma das baixas não pode passar do valor da dívida.
 *
 * Esta é a única invariante de dinheiro do módulo que o Postgres **não**
 * consegue defender sozinho: ela relaciona linhas de duas tabelas, e um CHECK
 * só enxerga a própria linha. Por isso mora aqui, com teste — e não num
 * gatilho escondido no banco.
 */
export function validatePayment(
  originalCents: number,
  alreadyPaidCents: number,
  newPaymentCents: number,
): { ok: true } | { ok: false; reason: string } {
  if (newPaymentCents <= 0) {
    return { ok: false, reason: "O valor da baixa precisa ser maior que zero." };
  }

  const restante = debtBalance(originalCents, alreadyPaidCents);
  if (restante === 0) {
    return { ok: false, reason: "Esta dívida já está quitada." };
  }
  if (newPaymentCents > restante) {
    return {
      ok: false,
      reason: `A baixa (${brl(newPaymentCents)}) é maior que o saldo devedor (${brl(restante)}).`,
    };
  }
  return { ok: true };
}

function brl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}
