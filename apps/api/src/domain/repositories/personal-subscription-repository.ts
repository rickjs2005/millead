import type { AlertType } from "../../application/services/subscription-alerts.js";
import type { SubscriptionPeriod } from "../../application/services/subscription-schedule.js";

/**
 * Assinaturas e seus alertas.
 *
 * No mesmo contrato porque alerta não existe sem assinatura (ou sem a cobrança
 * que sugere uma), e toda operação que mexe numa mexe na outra: registrar uma
 * cobrança avança a renovação E pode gerar alerta de variação de preço.
 *
 * Valores em **centavos inteiros** na fronteira, como no repositório de
 * regras — quem consome é a comparação de tolerância, que trabalha em centavos.
 */

export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";
export type AlertStatus = "PENDING" | "READ" | "SNOOZED";

export interface PersonalSubscription {
  id: string;
  vaultId: string;
  name: string;
  merchantId: string | null;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  expectedCents: number;
  currency: "BRL" | "USD" | "EUR";
  period: SubscriptionPeriod;
  customIntervalDays: number | null;
  lastChargeAt: Date | null;
  nextRenewalAt: Date | null;
  alertDaysBefore: number;
  priceTolerancePct: number;
  status: SubscriptionStatus;
  autoRenew: boolean;
  /** Assinatura empresarial da MilWeb. Resolvido na fase 7, com verificação de
   *  posse dos dois lados — não há FK entre os dois mundos. */
  costSubscriptionId: string | null;
  notes: string | null;
}

export type CreateSubscriptionInput = Omit<PersonalSubscription, "id" | "vaultId">;
export type UpdateSubscriptionInput = Partial<CreateSubscriptionInput>;

export interface PersonalAlert {
  id: string;
  vaultId: string;
  subscriptionId: string | null;
  transactionId: string | null;
  type: AlertType;
  referenceDate: Date;
  dedupeKey: string;
  status: AlertStatus;
  snoozedUntil: Date | null;
  readAt: Date | null;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface NewAlert {
  subscriptionId: string | null;
  transactionId: string | null;
  type: AlertType;
  referenceDate: Date;
  dedupeKey: string;
  payload: Record<string, unknown>;
}

/** Cobrança candidata a pertencer a uma assinatura. */
export interface SubscriptionChargeCandidate {
  id: string;
  merchantId: string | null;
  normalizedDescription: string;
  transactionDate: Date;
  amountCents: number;
}

export interface PersonalSubscriptionRepository {
  list(vaultId: string, status: SubscriptionStatus | null): Promise<PersonalSubscription[]>;
  listActive(vaultId: string): Promise<PersonalSubscription[]>;
  findById(vaultId: string, id: string): Promise<PersonalSubscription | null>;
  /** Assinatura ativa daquele fornecedor — é o nível SUBSCRIPTION da cascata. */
  findActiveByMerchant(vaultId: string, merchantId: string): Promise<PersonalSubscription | null>;
  create(vaultId: string, input: CreateSubscriptionInput): Promise<PersonalSubscription>;
  update(
    vaultId: string,
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<PersonalSubscription | null>;
  delete(vaultId: string, id: string): Promise<boolean>;

  /** Cobranças já vinculadas a uma assinatura, mais recentes primeiro. */
  listCharges(
    vaultId: string,
    subscriptionId: string,
    limit: number,
  ): Promise<SubscriptionChargeCandidate[]>;
  /** Cobranças confirmadas AINDA sem assinatura, para o casamento e a detecção
   *  de recorrência. */
  listUnlinkedCharges(vaultId: string, since: Date): Promise<SubscriptionChargeCandidate[]>;
  /** Vincula a cobrança à assinatura. */
  linkCharge(vaultId: string, transactionId: string, subscriptionId: string): Promise<boolean>;

  // ----- Alertas -----

  /** Grava os alertas novos, ignorando os que já existem (unique de
   *  `dedupeKey`). Devolve quantos entraram — é o que faz a verificação a cada
   *  abertura do app não encher a tela de repetição. */
  createAlerts(vaultId: string, alerts: readonly NewAlert[]): Promise<number>;
  /** Alertas que ainda pedem atenção: pendentes e adiados cujo prazo venceu. */
  listActionable(vaultId: string, today: Date): Promise<PersonalAlert[]>;
  countActionable(vaultId: string, today: Date): Promise<number>;
  markRead(vaultId: string, id: string, readAt: Date): Promise<PersonalAlert | null>;
  snooze(vaultId: string, id: string, until: Date): Promise<PersonalAlert | null>;
}
