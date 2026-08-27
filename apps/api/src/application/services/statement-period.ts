import { addUtcMonths, clampDayToMonth, startOfUtcMonth, utcDate } from "./vault-date.js";

/**
 * Em qual fatura uma compra de cartão cai.
 *
 * Regra: compra até o dia de fechamento (inclusive) entra na fatura que fecha
 * naquele mês; depois disso, na do mês seguinte. O vencimento é no mês do
 * fechamento quando o dia de vencimento vem depois do de fechamento, e no mês
 * seguinte quando vem antes — cartão que fecha dia 25 e vence dia 5 vence
 * sempre em outubro pela fatura fechada em setembro, nunca antes de existir.
 *
 * Dia 31 encolhe pro último dia do mês (fevereiro fecha dia 28 ou 29). Sem
 * isso, `Date.UTC(2026, 1, 31)` viraria 3 de março em silêncio e a fatura
 * inteira mudaria de mês.
 */
export interface StatementPeriodInput {
  purchaseDate: Date;
  closingDay: number;
  dueDay: number;
}

export interface StatementPeriod {
  /** Primeiro dia do mês de referência (o mês em que a fatura fecha). */
  referenceMonth: Date;
  closingDate: Date;
  dueDate: Date;
}

export function resolveStatementPeriod(input: StatementPeriodInput): StatementPeriod {
  const { purchaseDate, closingDay, dueDay } = input;

  // Dia fora do calendário não vira fatura chutada: a configuração do cartão
  // está errada e quem chamou precisa saber.
  assertDayOfMonth(closingDay, "closingDay");
  assertDayOfMonth(dueDay, "dueDay");

  const year = purchaseDate.getUTCFullYear();
  const month = purchaseDate.getUTCMonth() + 1;
  const closingThisMonth = clampDayToMonth(year, month, closingDay);

  // A fatura que fecha neste mês, ou a próxima se a compra passou do fechamento.
  const monthsAhead = purchaseDate.getUTCDate() <= closingThisMonth ? 0 : 1;
  const referenceMonth = addUtcMonths(startOfUtcMonth(purchaseDate), monthsAhead);

  const closingYear = referenceMonth.getUTCFullYear();
  const closingMonth = referenceMonth.getUTCMonth() + 1;
  const closingDate = utcDate(
    closingYear,
    closingMonth,
    clampDayToMonth(closingYear, closingMonth, closingDay),
  );

  const dueMonthsAhead = dueDay > closingDay ? 0 : 1;
  const dueBase = addUtcMonths(referenceMonth, dueMonthsAhead);
  const dueYear = dueBase.getUTCFullYear();
  const dueMonth = dueBase.getUTCMonth() + 1;
  const dueDate = utcDate(dueYear, dueMonth, clampDayToMonth(dueYear, dueMonth, dueDay));

  return { referenceMonth, closingDate, dueDate };
}

function assertDayOfMonth(day: number, field: string): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`${field} precisa ser um dia do mês entre 1 e 31 (recebido: ${day}).`);
  }
}

/**
 * Status de uma fatura a partir dos números, nunca de um campo escrito à mão.
 *
 * Derivar em vez de guardar evita o estado impossível clássico: fatura marcada
 * como PAGA com saldo em aberto porque alguém editou uma movimentação depois do
 * pagamento e o status ficou pra trás.
 */
export interface StatementStatusInput {
  /** Centavos já parseados -- ver `vault-money.ts`. */
  totalCents: number;
  paidCents: number;
  closingDate: Date;
  dueDate: Date;
  today: Date;
}

export type StatementStatus = "OPEN" | "CLOSED" | "PARTIAL" | "PAID" | "OVERDUE";

export function resolveStatementStatus(input: StatementStatusInput): StatementStatus {
  const { totalCents, paidCents, closingDate, dueDate, today } = input;

  // Quitada vence qualquer outra leitura, inclusive vencimento passado.
  if (totalCents > 0 && paidCents >= totalCents) return "PAID";

  const vencida = today.getTime() > dueDate.getTime();
  if (vencida) return "OVERDUE";

  if (paidCents > 0) return "PARTIAL";

  // Fechada mas ainda no prazo: o valor não muda mais, só falta pagar.
  return today.getTime() > closingDate.getTime() ? "CLOSED" : "OPEN";
}
