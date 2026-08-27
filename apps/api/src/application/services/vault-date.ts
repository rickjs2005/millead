/**
 * Datas do Cofre, sempre em UTC à meia-noite.
 *
 * As colunas de data são `@db.Date` — dia, sem hora. Construir com
 * `new Date(2026, 7, 27)` usa o fuso da máquina: no Render (UTC) dá
 * `2026-08-27T00:00Z`, mas num servidor a leste do meridiano dá
 * `2026-08-26T22:00Z`, e o Postgres grava **26**. A data anda um dia, o
 * lançamento troca de mês, e o total do mês fecha errado.
 *
 * Por isso nada aqui usa o construtor local: só `Date.UTC`.
 */

/** Ano, mês (1-12) e dia -> Date em UTC à meia-noite. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** `2026-08-27` — o formato que o Postgres e o front esperam. */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Último dia do mês (1-12) daquele ano. */
export function lastDayOfMonth(year: number, month: number): number {
  // Dia 0 do mês seguinte é o último dia deste.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Encolhe o dia até caber no mês. Cartão que fecha dia 31 fecha dia 28 em
 * fevereiro — sem isso, `Date.UTC(2026, 1, 31)` silenciosamente vira 3 de
 * março e a fatura inteira muda de mês.
 */
export function clampDayToMonth(year: number, month: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month));
}

/** Primeiro dia do mês da data. */
export function startOfUtcMonth(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

/** Avança (ou retrocede) meses preservando o dia, sem transbordar o mês. */
export function addUtcMonths(date: Date, months: number): Date {
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return utcDate(year, month, clampDayToMonth(year, month, date.getUTCDate()));
}

/**
 * Lê data de extrato. Aceita o `AAAAMMDD` do OFX (com ou sem hora/fuso
 * anexados, que alguns bancos mandam) e o ISO `AAAA-MM-DD`.
 *
 * Devolve `null` em vez de lançar: numa importação de centenas de linhas, uma
 * data ilegível é uma linha a reportar, não o arquivo inteiro a perder.
 */
export function parseUtcDate(value: string): Date | null {
  const trimmed = value.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  const ofx = /^(\d{4})(\d{2})(\d{2})/.exec(trimmed);
  const match = iso ?? ofx;
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > lastDayOfMonth(year, month)) return null;

  return utcDate(year, month, day);
}
