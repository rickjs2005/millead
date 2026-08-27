import { addUtcMonths, utcDate } from "./vault-date.js";

/**
 * Quando a assinatura renova de novo.
 *
 * Calculado sempre a partir da ÚLTIMA cobrança, não iterando a partir da data
 * de cadastro. A diferença aparece no dia 31: uma assinatura cobrada em 31/01
 * cai em 28/02, e a próxima sai de 28/02 — não volta pro dia 31. Isso é
 * deliberado: a data que importa é a que o banco cobrou de verdade, e um
 * "dia âncora" ideal divergiria da realidade a cada mês curto.
 */

export type SubscriptionPeriod = "MONTHLY" | "YEARLY" | "CUSTOM";

export interface ScheduleInput {
  lastChargeAt: Date;
  period: SubscriptionPeriod;
  /** Obrigatório em CUSTOM. */
  customIntervalDays?: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function nextRenewal(input: ScheduleInput): Date {
  const { lastChargeAt, period, customIntervalDays } = input;

  switch (period) {
    case "MONTHLY":
      // `addUtcMonths` já encolhe o dia pro último do mês de destino.
      return addUtcMonths(lastChargeAt, 1);
    case "YEARLY":
      return addUtcMonths(lastChargeAt, 12);
    case "CUSTOM": {
      if (!customIntervalDays || customIntervalDays < 1) {
        // Chutar 30 dias aqui produziria uma data de renovação plausível e
        // errada, e o alerta chegaria no dia errado sem nada denunciando.
        throw new Error("Assinatura personalizada exige o intervalo em dias.");
      }
      const target = new Date(lastChargeAt.getTime() + customIntervalDays * MS_PER_DAY);
      return utcDate(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
    }
  }
}

/**
 * Dias inteiros de `from` até `to`. Negativo quando `to` já passou.
 *
 * As duas datas são de calendário em UTC (ver `vault-date.ts`), então a
 * divisão é exata — sem horário de verão nem fração de dia pra arredondar.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}
