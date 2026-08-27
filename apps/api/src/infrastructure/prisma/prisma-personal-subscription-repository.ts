import { Prisma, prisma } from "@millead/database";
import { formatMoney, parseMoney } from "../../application/services/vault-money.js";
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

const subscriptionSelect = {
  id: true,
  vaultId: true,
  name: true,
  merchantId: true,
  categoryId: true,
  accountId: true,
  cardId: true,
  expectedAmount: true,
  currency: true,
  period: true,
  customIntervalDays: true,
  lastChargeAt: true,
  nextRenewalAt: true,
  alertDaysBefore: true,
  priceTolerancePct: true,
  status: true,
  autoRenew: true,
  costSubscriptionId: true,
  notes: true,
} as const;

const alertSelect = {
  id: true,
  vaultId: true,
  subscriptionId: true,
  transactionId: true,
  type: true,
  referenceDate: true,
  dedupeKey: true,
  status: true,
  snoozedUntil: true,
  readAt: true,
  payload: true,
  createdAt: true,
} as const;

const chargeSelect = {
  id: true,
  merchantId: true,
  normalizedDescription: true,
  transactionDate: true,
  amountBrl: true,
} as const;

type SubscriptionRow = Prisma.PersonalSubscriptionGetPayload<{ select: typeof subscriptionSelect }>;
type AlertRow = Prisma.PersonalSubscriptionAlertGetPayload<{ select: typeof alertSelect }>;
type ChargeRow = Prisma.PersonalTransactionGetPayload<{ select: typeof chargeSelect }>;

function toSubscription(row: SubscriptionRow): PersonalSubscription {
  const { expectedAmount, priceTolerancePct, ...rest } = row;
  return {
    ...rest,
    expectedCents: parseMoney(expectedAmount.toString()),
    priceTolerancePct: Number(priceTolerancePct.toString()),
  };
}

function toRow(input: Partial<CreateSubscriptionInput>) {
  const { expectedCents, priceTolerancePct, ...rest } = input;
  return {
    ...rest,
    ...(expectedCents !== undefined ? { expectedAmount: formatMoney(expectedCents) } : {}),
    ...(priceTolerancePct !== undefined ? { priceTolerancePct: String(priceTolerancePct) } : {}),
  };
}

function toAlert(row: AlertRow): PersonalAlert {
  return { ...row, payload: (row.payload as Record<string, unknown> | null) ?? {} };
}

function toCharge(row: ChargeRow): SubscriptionChargeCandidate {
  return {
    id: row.id,
    merchantId: row.merchantId,
    normalizedDescription: row.normalizedDescription,
    transactionDate: row.transactionDate,
    amountCents: parseMoney(row.amountBrl.toString()),
  };
}

export class PrismaPersonalSubscriptionRepository implements PersonalSubscriptionRepository {
  async list(vaultId: string, status: SubscriptionStatus | null): Promise<PersonalSubscription[]> {
    const rows = await prisma.personalSubscription.findMany({
      where: { vaultId, ...(status ? { status } : {}) },
      select: subscriptionSelect,
      orderBy: [{ status: "asc" }, { nextRenewalAt: "asc" }, { name: "asc" }],
    });
    return rows.map(toSubscription);
  }

  listActive(vaultId: string): Promise<PersonalSubscription[]> {
    return this.list(vaultId, "ACTIVE");
  }

  async findById(vaultId: string, id: string): Promise<PersonalSubscription | null> {
    const row = await prisma.personalSubscription.findFirst({
      where: { id, vaultId },
      select: subscriptionSelect,
    });
    return row ? toSubscription(row) : null;
  }

  async findActiveByMerchant(
    vaultId: string,
    merchantId: string,
  ): Promise<PersonalSubscription | null> {
    const row = await prisma.personalSubscription.findFirst({
      where: { vaultId, merchantId, status: "ACTIVE" },
      select: subscriptionSelect,
      // Duas assinaturas ativas do mesmo fornecedor já geram alerta de
      // duplicata; aqui a ordem só precisa ser estável pra a classificação não
      // alternar entre execuções.
      orderBy: { id: "asc" },
    });
    return row ? toSubscription(row) : null;
  }

  async create(vaultId: string, input: CreateSubscriptionInput): Promise<PersonalSubscription> {
    const row = await prisma.personalSubscription.create({
      data: { vaultId, ...toRow(input) } as Prisma.PersonalSubscriptionUncheckedCreateInput,
      select: subscriptionSelect,
    });
    return toSubscription(row);
  }

  async update(
    vaultId: string,
    id: string,
    patch: UpdateSubscriptionInput,
  ): Promise<PersonalSubscription | null> {
    const { count } = await prisma.personalSubscription.updateMany({
      where: { id, vaultId },
      data: toRow(patch),
    });
    if (count === 0) return null;
    return this.findById(vaultId, id);
  }

  async delete(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalSubscription.deleteMany({ where: { id, vaultId } });
    return count > 0;
  }

  async listCharges(
    vaultId: string,
    subscriptionId: string,
    limit: number,
  ): Promise<SubscriptionChargeCandidate[]> {
    const rows = await prisma.personalTransaction.findMany({
      where: { vaultId, subscriptionId, status: { not: "REVERSED" } },
      select: chargeSelect,
      orderBy: { transactionDate: "desc" },
      take: limit,
    });
    return rows.map(toCharge);
  }

  async listUnlinkedCharges(vaultId: string, since: Date): Promise<SubscriptionChargeCandidate[]> {
    const rows = await prisma.personalTransaction.findMany({
      where: {
        vaultId,
        subscriptionId: null,
        transactionDate: { gte: since },
        direction: "OUT",
        // Transferência não é cobrança de assinatura, e linha estornada ou
        // ignorada não deve sugerir nada.
        isTransfer: false,
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      select: chargeSelect,
      orderBy: { transactionDate: "asc" },
    });
    return rows.map(toCharge);
  }

  async linkCharge(
    vaultId: string,
    transactionId: string,
    subscriptionId: string,
  ): Promise<boolean> {
    const { count } = await prisma.personalTransaction.updateMany({
      where: { id: transactionId, vaultId },
      data: { subscriptionId },
    });
    return count > 0;
  }

  // ----- Alertas -----

  async createAlerts(vaultId: string, alerts: readonly NewAlert[]): Promise<number> {
    if (alerts.length === 0) return 0;
    // `skipDuplicates` sobre o unique de `dedupeKey`: é isto que faz a
    // verificação rodar a cada abertura do app sem multiplicar o mesmo aviso.
    const { count } = await prisma.personalSubscriptionAlert.createMany({
      data: alerts.map((alert) => ({
        vaultId,
        subscriptionId: alert.subscriptionId,
        transactionId: alert.transactionId,
        type: alert.type,
        referenceDate: alert.referenceDate,
        dedupeKey: alert.dedupeKey,
        payload: alert.payload as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
    return count;
  }

  async listActionable(vaultId: string, today: Date): Promise<PersonalAlert[]> {
    const rows = await prisma.personalSubscriptionAlert.findMany({
      where: {
        vaultId,
        OR: [
          { status: "PENDING" },
          // Adiado volta sozinho quando o prazo vence — senão "adiar" seria
          // "esconder pra sempre", que não é o que a palavra promete.
          { status: "SNOOZED", snoozedUntil: { lte: today } },
        ],
      },
      select: alertSelect,
      orderBy: [{ referenceDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toAlert);
  }

  async countActionable(vaultId: string, today: Date): Promise<number> {
    return prisma.personalSubscriptionAlert.count({
      where: {
        vaultId,
        OR: [{ status: "PENDING" }, { status: "SNOOZED", snoozedUntil: { lte: today } }],
      },
    });
  }

  async markRead(vaultId: string, id: string, readAt: Date): Promise<PersonalAlert | null> {
    const { count } = await prisma.personalSubscriptionAlert.updateMany({
      where: { id, vaultId },
      data: { status: "READ", readAt },
    });
    if (count === 0) return null;
    const row = await prisma.personalSubscriptionAlert.findFirst({
      where: { id, vaultId },
      select: alertSelect,
    });
    return row ? toAlert(row) : null;
  }

  async snooze(vaultId: string, id: string, until: Date): Promise<PersonalAlert | null> {
    const { count } = await prisma.personalSubscriptionAlert.updateMany({
      where: { id, vaultId },
      data: { status: "SNOOZED", snoozedUntil: until },
    });
    if (count === 0) return null;
    const row = await prisma.personalSubscriptionAlert.findFirst({
      where: { id, vaultId },
      select: alertSelect,
    });
    return row ? toAlert(row) : null;
  }
}
