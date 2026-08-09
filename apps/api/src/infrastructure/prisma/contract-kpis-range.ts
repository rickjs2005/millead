/**
 * Cortes temporais (mês e ano correntes) usados pelos KPIs de contrato --
 * mesma convenção de `currentMonthInTimeZone`/`monthRangeSp` em
 * cost-service.ts/receivable-service.ts (America/Sao_Paulo pra decidir "qual
 * mês/ano é hoje" E pra decidir onde o corte de virada de mês/ano cai). Cada
 * domínio mantém sua própria cópia -- ver brief da Task 3 -- então isto NÃO
 * importa dos services de finanças pra não acoplar camadas. Extraída como
 * função pura, sem depender do Prisma (igual social-snapshot-day.ts/
 * audit-query.ts/briefing-where.ts), pra ser testável isolada.
 */
export function currentMonthInTimeZone(
  now: Date = new Date(),
  timeZone = "America/Sao_Paulo",
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/** Brasil aboliu horário de verão em 2019; America/Sao_Paulo é UTC-3 fixo o
 *  ano inteiro. Meia-noite de Brasília = 03:00 UTC. Se o DST voltar, este é
 *  o único lugar a ajustar (nesta cópia). */
const SP_UTC_OFFSET_HOURS = 3;

/** Intervalo [from, to) em UTC pra filtrar `assinadoEm` de um mês "YYYY-MM",
 *  cortado em meia-noite de Brasília (não meia-noite UTC). */
export function monthRangeSp(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1, SP_UTC_OFFSET_HOURS, 0, 0)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1, SP_UTC_OFFSET_HOURS, 0, 0)),
  };
}

/** Intervalo [from, to) em UTC pro ano de um mês "YYYY-MM" (o ano inteiro),
 *  cortado em meia-noite de Brasília. */
export function yearRangeSp(month: string): { from: Date; to: Date } {
  const year = Number(month.split("-")[0]);
  return {
    from: new Date(Date.UTC(year, 0, 1, SP_UTC_OFFSET_HOURS, 0, 0)),
    to: new Date(Date.UTC(year + 1, 0, 1, SP_UTC_OFFSET_HOURS, 0, 0)),
  };
}

export interface ContractKpisRanges {
  monthFrom: Date;
  monthTo: Date;
  yearFrom: Date;
  yearTo: Date;
}

/** Junta os dois cortes (mês + ano correntes) que os KPIs de contrato usam. */
export function contractKpisRanges(now: Date = new Date()): ContractKpisRanges {
  const month = currentMonthInTimeZone(now);
  const { from: monthFrom, to: monthTo } = monthRangeSp(month);
  const { from: yearFrom, to: yearTo } = yearRangeSp(month);
  return { monthFrom, monthTo, yearFrom, yearTo };
}
