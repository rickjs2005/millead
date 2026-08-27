import { daysBetween } from "./subscription-schedule.js";
import { normalizeDescription } from "./transaction-text.js";
import { formatUtcDate, startOfUtcMonth } from "./vault-date.js";
import { formatMoney } from "./vault-money.js";

/**
 * Geração dos alertas de assinatura.
 *
 * Tudo aqui é puro e **idempotente por construção**: a verificação roda a cada
 * abertura do app, e sem uma chave estável "Claude renova amanhã" nasceria de
 * novo a cada consulta. `dedupeKey` junta tipo + âncora + data de referência —
 * rodar duas vezes no mesmo dia produz exatamente as mesmas chaves, e o unique
 * do banco descarta a repetição.
 */

export type AlertType =
  | "RENEWS_TODAY"
  | "RENEWS_TOMORROW"
  | "RENEWS_IN_3_DAYS"
  | "RENEWS_IN_7_DAYS"
  | "PRICE_CHANGED"
  | "POSSIBLE_DUPLICATE"
  | "MISSING_CHARGE"
  | "POSSIBLE_NEW_SUBSCRIPTION";

export interface AlertSubscription {
  id: string;
  name: string;
  merchantId: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELED";
  expectedCents: number;
  priceTolerancePct: number;
  alertDaysBefore: number;
  nextRenewalAt: Date | null;
}

export interface AlertDraft {
  type: AlertType;
  subscriptionId: string | null;
  transactionId: string | null;
  referenceDate: Date;
  dedupeKey: string;
  payload: Record<string, unknown>;
}

/** Dias de antecedência que viram alerta, do mais urgente ao menos. */
const RENEWAL_STEPS: ReadonlyArray<{ days: number; type: AlertType }> = [
  { days: 0, type: "RENEWS_TODAY" },
  { days: 1, type: "RENEWS_TOMORROW" },
  { days: 3, type: "RENEWS_IN_3_DAYS" },
  { days: 7, type: "RENEWS_IN_7_DAYS" },
];

/**
 * Dias de folga antes de acusar cobrança faltando.
 *
 * Banco atrasa. Alertar no dia seguinte geraria falso positivo toda vez que a
 * cobrança caísse com um dia de diferença — e alerta que erra é alerta que
 * você para de ler.
 */
const MISSING_CHARGE_GRACE_DAYS = 3;

/** Quanto dois valores podem diferir e ainda parecerem a mesma assinatura. */
const DUPLICATE_AMOUNT_TOLERANCE_PCT = 15;

export function buildDedupeKey(type: AlertType, anchorId: string, referenceDate: Date): string {
  return `${type}:${anchorId}:${formatUtcDate(referenceDate)}`;
}

/** Alertas que saem do calendário: renovação chegando e cobrança que não veio. */
export function buildScheduleAlerts(
  subscriptions: readonly AlertSubscription[],
  today: Date,
): AlertDraft[] {
  const alerts: AlertDraft[] = [];

  for (const subscription of subscriptions) {
    // Pausada e cancelada não geram alerta -- exigência explícita, e a razão é
    // óbvia depois de pausar a primeira: você pausou justamente pra parar de
    // ser lembrado.
    if (subscription.status !== "ACTIVE" || !subscription.nextRenewalAt) continue;

    const dias = daysBetween(today, subscription.nextRenewalAt);

    if (dias < -MISSING_CHARGE_GRACE_DAYS) {
      alerts.push(
        draft("MISSING_CHARGE", subscription, subscription.nextRenewalAt, {
          expectedOn: formatUtcDate(subscription.nextRenewalAt),
          diasAtrasada: Math.abs(dias),
        }),
      );
      continue;
    }

    const marco = RENEWAL_STEPS.find((step) => step.days === dias);
    if (!marco) continue;
    // Antecedência configurada: quem escolheu 1 dia não quer o aviso de 7.
    if (marco.days > subscription.alertDaysBefore) continue;

    alerts.push(draft(marco.type, subscription, subscription.nextRenewalAt, {}));
  }

  return alerts;
}

/**
 * Assinaturas ativas que parecem ser a mesma coisa.
 *
 * Um alerta por PAR, não um por assinatura: dois alertas dizendo a mesma coisa
 * dobrariam o contador sem informação nova. A âncora é o par ordenado, então a
 * chave é a mesma independentemente da ordem em que as duas aparecem.
 */
export function buildDuplicateAlerts(
  subscriptions: readonly AlertSubscription[],
  today: Date,
): AlertDraft[] {
  const ativas = subscriptions.filter((s) => s.status === "ACTIVE");
  const alerts: AlertDraft[] = [];
  // Mensal: um par suspeito não precisa ser lembrado todo dia.
  const referenceDate = startOfUtcMonth(today);

  for (let i = 0; i < ativas.length; i++) {
    for (let j = i + 1; j < ativas.length; j++) {
      const a = ativas[i]!;
      const b = ativas[j]!;
      if (!looksLikeSame(a, b)) continue;

      const [first, second] = [a.id, b.id].sort();
      alerts.push({
        type: "POSSIBLE_DUPLICATE",
        subscriptionId: a.id,
        transactionId: null,
        referenceDate,
        dedupeKey: buildDedupeKey("POSSIBLE_DUPLICATE", `${first}+${second}`, referenceDate),
        payload: {
          names: [a.name, b.name],
          subscriptionIds: [first, second],
          expectedAmounts: [formatMoney(a.expectedCents), formatMoney(b.expectedCents)],
        },
      });
    }
  }

  return alerts;
}

export interface AlertCharge {
  id: string;
  date: Date;
  amountCents: number;
}

/**
 * A cobrança bateu com o valor esperado?
 *
 * Alerta nos dois sentidos: queda grande costuma ser mudança de plano ou
 * cobrança parcial, e vale saber tanto quanto um aumento.
 */
export function evaluateChargeAgainstSubscription(
  subscription: AlertSubscription,
  charge: AlertCharge,
): AlertDraft | null {
  if (subscription.expectedCents <= 0) return null;

  const variacao =
    (Math.abs(charge.amountCents - subscription.expectedCents) / subscription.expectedCents) * 100;
  if (variacao <= subscription.priceTolerancePct) return null;

  return {
    type: "PRICE_CHANGED",
    subscriptionId: subscription.id,
    transactionId: charge.id,
    referenceDate: charge.date,
    // Ancorado na MOVIMENTAÇÃO: duas cobranças diferentes do mesmo mês são dois
    // alertas legítimos, e ancorar na assinatura esconderia a segunda.
    dedupeKey: buildDedupeKey("PRICE_CHANGED", charge.id, charge.date),
    payload: {
      name: subscription.name,
      expectedAmount: formatMoney(subscription.expectedCents),
      chargedAmount: formatMoney(charge.amountCents),
      variacaoPct: Number(variacao.toFixed(2)),
    },
  };
}

function draft(
  type: AlertType,
  subscription: AlertSubscription,
  referenceDate: Date,
  extra: Record<string, unknown>,
): AlertDraft {
  return {
    type,
    subscriptionId: subscription.id,
    transactionId: null,
    referenceDate,
    dedupeKey: buildDedupeKey(type, subscription.id, referenceDate),
    payload: {
      name: subscription.name,
      expectedAmount: formatMoney(subscription.expectedCents),
      ...extra,
    },
  };
}

function looksLikeSame(a: AlertSubscription, b: AlertSubscription): boolean {
  const mesmoFornecedor = a.merchantId !== null && a.merchantId === b.merchantId;
  const mesmoNome =
    a.merchantId === null &&
    b.merchantId === null &&
    normalizeDescription(a.name) === normalizeDescription(b.name);
  if (!mesmoFornecedor && !mesmoNome) return false;

  const maior = Math.max(a.expectedCents, b.expectedCents);
  if (maior <= 0) return false;
  const variacao = (Math.abs(a.expectedCents - b.expectedCents) / maior) * 100;
  return variacao <= DUPLICATE_AMOUNT_TOLERANCE_PCT;
}
