import { daysBetween, type SubscriptionPeriod } from "./subscription-schedule.js";

/**
 * Detecção de assinatura a partir das cobranças de um mesmo fornecedor.
 *
 * A regra que manda: **uma cobrança nunca vira assinatura**. Uma compra é uma
 * compra; assinatura é uma afirmação sobre o futuro ("isso vai ser cobrado de
 * novo") e afirmar isso com uma ocorrência só é adivinhação. A partir de duas
 * cobranças compatíveis, vira **sugestão** — nunca cadastro automático.
 *
 * (A exceção combinada — vínculo manual com uma assinatura empresarial já
 * ativa — é decidida pelo serviço, que tem esse contexto; aqui só mora a
 * evidência que as cobranças por si dão.)
 */

export interface ChargeSample {
  date: Date;
  amountCents: number;
}

export interface RecurrenceOptions {
  /** Quanto o intervalo mensal pode variar. Meses têm 28 a 31 dias, e o banco
   *  ainda atrasa um pouco — janela apertada demais rejeitaria assinatura de
   *  verdade. */
  monthlyWindowDays?: number;
  yearlyWindowDays?: number;
  /** Quanto o valor pode variar entre cobranças, em porcentagem. */
  amountTolerancePct?: number;
  /** Tolerância do intervalo para o caso personalizado. */
  customWindowDays?: number;
}

export interface RecurrenceSuggestion {
  period: SubscriptionPeriod;
  /** Intervalo médio observado, em dias. */
  intervalDays: number;
  /** Valor esperado da PRÓXIMA cobrança. */
  expectedCents: number;
  occurrences: number;
}

const DEFAULTS: Required<RecurrenceOptions> = {
  monthlyWindowDays: 6,
  yearlyWindowDays: 20,
  amountTolerancePct: 15,
  customWindowDays: 5,
};

export function detectRecurrence(
  charges: readonly ChargeSample[],
  options: RecurrenceOptions = {},
): RecurrenceSuggestion | null {
  const { monthlyWindowDays, yearlyWindowDays, amountTolerancePct, customWindowDays } = {
    ...DEFAULTS,
    ...options,
  };

  if (charges.length < 2) return null;

  const ordered = [...charges].sort((a, b) => a.date.getTime() - b.date.getTime());

  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    gaps.push(daysBetween(ordered[i - 1]!.date, ordered[i]!.date));
  }
  // Duas cobranças no mesmo dia são duplicata ou compra dupla, não cadência.
  if (gaps.some((gap) => gap <= 0)) return null;

  // O valor esperado é o da cobrança MAIS RECENTE, não a média: é o preço que
  // vale hoje, e é ele que vai ser cobrado de novo. Uma média puxaria o
  // esperado pra baixo depois de um reajuste e geraria alerta de variação na
  // cobrança seguinte, que estaria certa.
  const expectedCents = ordered[ordered.length - 1]!.amountCents;
  if (!amountsAreCompatible(ordered, expectedCents, amountTolerancePct)) return null;

  const intervalDays = Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
  const occurrences = ordered.length;

  if (gaps.every((gap) => Math.abs(gap - 30) <= monthlyWindowDays)) {
    return { period: "MONTHLY", intervalDays, expectedCents, occurrences };
  }
  if (gaps.every((gap) => Math.abs(gap - 365) <= yearlyWindowDays)) {
    return { period: "YEARLY", intervalDays, expectedCents, occurrences };
  }
  // Cadência própria (trimestral, semanal...): só quando os intervalos são
  // consistentes ENTRE SI. Intervalos irregulares são compras avulsas no mesmo
  // lugar, e chamá-las de assinatura encheria a tela de alertas falsos.
  if (gaps.every((gap) => Math.abs(gap - intervalDays) <= customWindowDays)) {
    return { period: "CUSTOM", intervalDays, expectedCents, occurrences };
  }

  return null;
}

function amountsAreCompatible(
  charges: readonly ChargeSample[],
  reference: number,
  tolerancePct: number,
): boolean {
  if (reference <= 0) return false;
  return charges.every(
    (charge) => (Math.abs(charge.amountCents - reference) / reference) * 100 <= tolerancePct,
  );
}
