import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalCatalogRepository } from "../../domain/repositories/personal-catalog-repository.js";
import type {
  CreateSubscriptionInput,
  NewAlert,
  PersonalAlert,
  PersonalSubscription,
  PersonalSubscriptionRepository,
  SubscriptionChargeCandidate,
  SubscriptionStatus,
  UpdateSubscriptionInput,
} from "../../domain/repositories/personal-subscription-repository.js";
import type { PushSender } from "../../domain/services/push-sender.js";
import { detectRecurrence } from "./subscription-detection.js";
import {
  buildDedupeKey,
  buildDuplicateAlerts,
  buildScheduleAlerts,
  evaluateChargeAgainstSubscription,
  type AlertSubscription,
} from "./subscription-alerts.js";
import { nextRenewal } from "./subscription-schedule.js";
import { addUtcMonths, startOfUtcMonth, utcDate } from "./vault-date.js";
import { formatMoney } from "./vault-money.js";

/**
 * Assinaturas, detecção de recorrência e alertas.
 *
 * ## Entrega dos alertas sem depender do worker
 *
 * O ambiente é gratuito e o processo dorme. Por isso a verificação tem dois
 * níveis, e o **primeiro é o que garante**: `refresh()` roda a cada abertura
 * do app, calcula tudo do zero e grava o que falta. O push é a segunda camada,
 * best-effort — se o worker estiver dormindo, você vê os alertas na central
 * do mesmo jeito.
 *
 * A ordem importa: recalcular na abertura significa que a idempotência não é
 * um detalhe de implementação, é o que impede a tela de encher de repetição.
 * Quem garante isso é o `dedupeKey` (ver `subscription-alerts.ts`).
 */

/** Janela olhada para trás ao procurar cobranças novas e recorrências. */
const LOOKBACK_MONTHS = 14;

export interface RefreshResult {
  novosAlertas: number;
  cobrancasVinculadas: number;
  pendentes: PersonalAlert[];
}

export class PersonalSubscriptionService {
  constructor(
    private readonly subscriptions: PersonalSubscriptionRepository,
    private readonly catalog: PersonalCatalogRepository,
    private readonly push: PushSender,
  ) {}

  // ----- CRUD -----

  list(vaultId: string, status: SubscriptionStatus | null): Promise<PersonalSubscription[]> {
    return this.subscriptions.list(vaultId, status);
  }

  async get(vaultId: string, id: string): Promise<PersonalSubscription> {
    const subscription = await this.subscriptions.findById(vaultId, id);
    if (!subscription) throw new NotFoundError("Assinatura não encontrada.");
    return subscription;
  }

  async create(vaultId: string, input: CreateSubscriptionInput): Promise<PersonalSubscription> {
    await this.assertReferences(vaultId, input);

    // Quem informa a última cobrança já sabe quando renova; quem não informa,
    // descobre na primeira cobrança que aparecer no extrato.
    const nextRenewalAt =
      input.nextRenewalAt ??
      (input.lastChargeAt
        ? nextRenewal({
            lastChargeAt: input.lastChargeAt,
            period: input.period,
            customIntervalDays: input.customIntervalDays,
          })
        : null);

    return this.subscriptions.create(vaultId, { ...input, nextRenewalAt });
  }

  async update(
    vaultId: string,
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<PersonalSubscription> {
    const current = await this.get(vaultId, id);
    await this.assertReferences(vaultId, { ...current, ...patch });

    // Mudar a periodicidade sem recalcular deixaria a próxima renovação no
    // ritmo antigo, e o alerta chegaria no dia errado sem nada denunciando.
    const recalcular =
      patch.nextRenewalAt === undefined &&
      (patch.period !== undefined ||
        patch.customIntervalDays !== undefined ||
        patch.lastChargeAt !== undefined);

    const merged = { ...current, ...patch };
    const nextRenewalAt =
      recalcular && merged.lastChargeAt
        ? nextRenewal({
            lastChargeAt: merged.lastChargeAt,
            period: merged.period,
            customIntervalDays: merged.customIntervalDays,
          })
        : patch.nextRenewalAt;

    const updated = await this.subscriptions.update(vaultId, id, {
      ...patch,
      ...(nextRenewalAt !== undefined ? { nextRenewalAt } : {}),
    });
    if (!updated) throw new NotFoundError("Assinatura não encontrada.");
    return updated;
  }

  async delete(vaultId: string, id: string): Promise<void> {
    const deleted = await this.subscriptions.delete(vaultId, id);
    if (!deleted) throw new NotFoundError("Assinatura não encontrada.");
  }

  // ----- Verificação -----

  /**
   * Roda a cada abertura do app e do Cofre: casa cobranças novas, avança as
   * renovações, avalia preço e gera os alertas do calendário.
   *
   * Idempotente por construção — recalcular duas vezes no mesmo dia não cria
   * alerta repetido (ver `dedupeKey`).
   */
  async refresh(vaultId: string, today: Date, notifyUserId?: string): Promise<RefreshResult> {
    const ativas = await this.subscriptions.listActive(vaultId);
    const since = addUtcMonths(startOfUtcMonth(today), -LOOKBACK_MONTHS);
    const soltas = await this.subscriptions.listUnlinkedCharges(vaultId, since);

    const drafts: NewAlert[] = [];
    let cobrancasVinculadas = 0;

    // 1. Casa cobrança solta com assinatura (pelo fornecedor) e avança a
    //    renovação. É daqui que sai "última cobrança" e "próxima renovação".
    for (const subscription of ativas) {
      if (!subscription.merchantId) continue;
      const daAssinatura = soltas.filter((c) => c.merchantId === subscription.merchantId);
      if (daAssinatura.length === 0) continue;

      for (const charge of daAssinatura) {
        await this.subscriptions.linkCharge(vaultId, charge.id, subscription.id);
        cobrancasVinculadas++;

        const variacao = evaluateChargeAgainstSubscription(toAlertSubscription(subscription), {
          id: charge.id,
          date: charge.transactionDate,
          amountCents: charge.amountCents,
        });
        if (variacao) drafts.push(variacao);
      }

      const maisRecente = daAssinatura.reduce((a, b) =>
        a.transactionDate >= b.transactionDate ? a : b,
      );
      // Só avança se a cobrança for mais nova que a última conhecida --
      // importar um extrato antigo não pode empurrar a renovação pra trás.
      if (!subscription.lastChargeAt || maisRecente.transactionDate > subscription.lastChargeAt) {
        await this.subscriptions.update(vaultId, subscription.id, {
          lastChargeAt: maisRecente.transactionDate,
          nextRenewalAt: nextRenewal({
            lastChargeAt: maisRecente.transactionDate,
            period: subscription.period,
            customIntervalDays: subscription.customIntervalDays,
          }),
        });
      }
    }

    // 2. Alertas do calendário, sobre o estado JÁ atualizado.
    const atualizadas = await this.subscriptions.listActive(vaultId);
    const paraAlerta = atualizadas.map(toAlertSubscription);
    drafts.push(...buildScheduleAlerts(paraAlerta, today));
    drafts.push(...buildDuplicateAlerts(paraAlerta, today));

    // 3. Cobranças recorrentes que ainda não são assinatura.
    drafts.push(...this.detectSuggestions(soltas, atualizadas, today));

    const novosAlertas = await this.subscriptions.createAlerts(vaultId, drafts);
    const pendentes = await this.subscriptions.listActionable(vaultId, today);

    // Push é a SEGUNDA camada: no ambiente gratuito o worker dorme, então ele
    // nunca pode ser a única garantia. Falha aqui não muda nada do que já foi
    // gravado.
    if (notifyUserId && novosAlertas > 0) {
      await this.push
        .sendToUser(notifyUserId, {
          title: "Cofre Financeiro",
          body:
            novosAlertas === 1
              ? "1 alerta novo de assinatura."
              : `${novosAlertas} alertas novos de assinatura.`,
          url: "/cofre/alertas",
        })
        .catch(() => undefined);
    }

    return { novosAlertas, cobrancasVinculadas, pendentes };
  }

  listAlerts(vaultId: string, today: Date): Promise<PersonalAlert[]> {
    return this.subscriptions.listActionable(vaultId, today);
  }

  countAlerts(vaultId: string, today: Date): Promise<number> {
    return this.subscriptions.countActionable(vaultId, today);
  }

  async markAlertRead(vaultId: string, id: string): Promise<PersonalAlert> {
    const alert = await this.subscriptions.markRead(vaultId, id, new Date());
    if (!alert) throw new NotFoundError("Alerta não encontrado.");
    return alert;
  }

  async snoozeAlert(vaultId: string, id: string, until: Date): Promise<PersonalAlert> {
    const alert = await this.subscriptions.snooze(vaultId, id, until);
    if (!alert) throw new NotFoundError("Alerta não encontrado.");
    return alert;
  }

  // ----- Apoio -----

  /**
   * Cobranças recorrentes sem assinatura cadastrada viram **sugestão**, nunca
   * cadastro automático: uma assinatura criada sozinha começaria a gerar
   * alertas que você não pediu, com valor e data que ninguém conferiu.
   */
  private detectSuggestions(
    soltas: readonly SubscriptionChargeCandidate[],
    existentes: readonly PersonalSubscription[],
    today: Date,
  ): NewAlert[] {
    const jaTemAssinatura = new Set(
      existentes.flatMap((s) => (s.merchantId ? [s.merchantId] : [])),
    );

    // Agrupa por fornecedor quando há um; senão pela descrição normalizada, que
    // é a única pista estável que sobra.
    const grupos = new Map<string, SubscriptionChargeCandidate[]>();
    for (const charge of soltas) {
      if (charge.merchantId && jaTemAssinatura.has(charge.merchantId)) continue;
      const chave = charge.merchantId ?? `desc:${charge.normalizedDescription}`;
      grupos.set(chave, [...(grupos.get(chave) ?? []), charge]);
    }

    const referenceDate = startOfUtcMonth(today);
    const alerts: NewAlert[] = [];

    for (const [chave, charges] of grupos) {
      const sugestao = detectRecurrence(
        charges.map((c) => ({ date: c.transactionDate, amountCents: c.amountCents })),
      );
      if (!sugestao) continue;

      const maisRecente = charges.reduce((a, b) =>
        a.transactionDate >= b.transactionDate ? a : b,
      );
      alerts.push({
        type: "POSSIBLE_NEW_SUBSCRIPTION",
        subscriptionId: null,
        transactionId: maisRecente.id,
        referenceDate,
        // Ancorado no GRUPO, não na movimentação: senão cada nova cobrança do
        // mesmo fornecedor criaria mais uma sugestão da mesma coisa.
        dedupeKey: buildDedupeKey("POSSIBLE_NEW_SUBSCRIPTION", chave, referenceDate),
        payload: {
          description: maisRecente.normalizedDescription,
          merchantId: maisRecente.merchantId,
          period: sugestao.period,
          intervalDays: sugestao.intervalDays,
          expectedAmount: formatMoney(sugestao.expectedCents),
          occurrences: sugestao.occurrences,
        },
      });
    }

    return alerts;
  }

  private async assertReferences(
    vaultId: string,
    input: Partial<CreateSubscriptionInput>,
  ): Promise<void> {
    if (input.period === "CUSTOM" && !input.customIntervalDays) {
      throw new ValidationError("Periodicidade personalizada exige o intervalo em dias.");
    }
    if (input.period && input.period !== "CUSTOM" && input.customIntervalDays) {
      throw new ValidationError("Intervalo em dias só se aplica à periodicidade personalizada.");
    }
    if (input.categoryId) {
      const category = await this.catalog.findCategory(vaultId, input.categoryId);
      if (!category) throw new ValidationError("Categoria não encontrada neste Cofre.");
    }
    if (input.merchantId) {
      const merchant = await this.catalog.findMerchant(vaultId, input.merchantId);
      if (!merchant) throw new ValidationError("Fornecedor não encontrado neste Cofre.");
    }
  }
}

function toAlertSubscription(subscription: PersonalSubscription): AlertSubscription {
  return {
    id: subscription.id,
    name: subscription.name,
    merchantId: subscription.merchantId,
    status: subscription.status,
    expectedCents: subscription.expectedCents,
    priceTolerancePct: subscription.priceTolerancePct,
    alertDaysBefore: subscription.alertDaysBefore,
    nextRenewalAt: subscription.nextRenewalAt,
  };
}

/** Hoje, em data de calendário UTC — a mesma base de tudo no Cofre. */
export function todayUtc(now = new Date()): Date {
  return utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}
