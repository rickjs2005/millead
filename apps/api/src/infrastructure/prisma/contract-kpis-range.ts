/**
 * Cortes temporais (mês e ano correntes) usados pelos KPIs de contrato --
 * mesma convenção de `currentMonthInTimeZone`/`monthRangeUtc` em
 * cost-service.ts/receivable-service.ts (America/Sao_Paulo pra decidir "qual
 * mês/ano é hoje", cortes em UTC pra filtrar `assinadoEm` no banco). Cada
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

/** Intervalo [from, to) em UTC pra filtrar `assinadoEm` de um mês "YYYY-MM". */
export function monthRangeUtc(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

/** Intervalo [from, to) em UTC pro ano de um mês "YYYY-MM" (o ano inteiro). */
export function yearRangeUtc(month: string): { from: Date; to: Date } {
  const year = Number(month.split("-")[0]);
  return {
    from: new Date(Date.UTC(year, 0, 1)),
    to: new Date(Date.UTC(year + 1, 0, 1)),
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
  const { from: monthFrom, to: monthTo } = monthRangeUtc(month);
  const { from: yearFrom, to: yearTo } = yearRangeUtc(month);
  return { monthFrom, monthTo, yearFrom, yearTo };
}
