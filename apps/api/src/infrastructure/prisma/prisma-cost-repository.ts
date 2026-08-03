import { prisma, Prisma } from "@millead/database";
import type {
  CreateCostSubscriptionInput,
  CreateUsageEntryInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../../application/dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type {
  CostSubscription,
  CostServiceCatalog,
  CostUsageEntry,
  FinanceSettings,
} from "../../domain/entities/cost.js";

interface CostSubscriptionRow {
  id: string;
  organizationId: string;
  companyId: string | null;
  serviceKey: string | null;
  name: string;
  scope: CostSubscription["scope"];
  amount: Prisma.Decimal;
  currency: CostSubscription["currency"];
  billingCycle: CostSubscription["billingCycle"];
  capacityLimit: number | null;
  capacityUsed: number | null;
  creditsIncluded: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toDomainSubscription(row: CostSubscriptionRow): CostSubscription {
  return { ...row, amount: row.amount.toString() };
}

interface CostServiceCatalogRow {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  category: CostServiceCatalog["category"];
  defaultAmount: Prisma.Decimal;
  currency: CostServiceCatalog["currency"];
  billingCycle: CostServiceCatalog["billingCycle"];
  defaultScope: CostServiceCatalog["defaultScope"];
  defaultCapacityLimit: number | null;
  bestFor: string | null;
  billingNotes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toDomainCatalog(row: CostServiceCatalogRow): CostServiceCatalog {
  return { ...row, defaultAmount: row.defaultAmount.toString() };
}

interface FinanceSettingsRow {
  id: string;
  organizationId: string;
  usdToBrlRate: Prisma.Decimal;
  defaultHourlyRate: Prisma.Decimal;
  supportReservePct: Prisma.Decimal;
  defaultMarginPct: Prisma.Decimal;
  activeClientsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CostUsageEntryRow {
  id: string;
  organizationId: string;
  subscriptionId: string;
  companyId: string | null;
  credits: number;
  usedAt: Date;
  note: string | null;
  createdAt: Date;
  unitPriceBrl: Prisma.Decimal | null;
  company: { name: string } | null;
}

function toDomainUsage(row: CostUsageEntryRow): CostUsageEntry {
  return {
    id: row.id,
    organizationId: row.organizationId,
    subscriptionId: row.subscriptionId,
    companyId: row.companyId,
    companyName: row.company?.name ?? null,
    credits: row.credits,
    usedAt: row.usedAt,
    note: row.note,
    createdAt: row.createdAt,
    unitPriceBrl: row.unitPriceBrl != null ? Number(row.unitPriceBrl) : null,
  };
}

function toDomainSettings(row: FinanceSettingsRow): FinanceSettings {
  return {
    ...row,
    usdToBrlRate: row.usdToBrlRate.toString(),
    defaultHourlyRate: row.defaultHourlyRate.toString(),
    supportReservePct: row.supportReservePct.toString(),
    defaultMarginPct: row.defaultMarginPct.toString(),
  };
}

export class PrismaCostRepository implements CostRepository {
  async listSubscriptions(organizationId: string): Promise<CostSubscription[]> {
    const rows = await prisma.costSubscription.findMany({
      where: { organizationId },
      orderBy: [{ scope: "asc" }, { isActive: "desc" }, { name: "asc" }],
    });
    return rows.map(toDomainSubscription);
  }

  async findSubscriptionById(
    organizationId: string,
    id: string,
  ): Promise<CostSubscription | null> {
    const row = await prisma.costSubscription.findFirst({ where: { id, organizationId } });
    return row ? toDomainSubscription(row) : null;
  }

  async createSubscription(
    organizationId: string,
    data: CreateCostSubscriptionInput,
  ): Promise<CostSubscription> {
    const row = await prisma.costSubscription.create({ data: { ...data, organizationId } });
    return toDomainSubscription(row);
  }

  async updateSubscription(
    organizationId: string,
    id: string,
    data: UpdateCostSubscriptionInput,
  ): Promise<CostSubscription | null> {
    const { count } = await prisma.costSubscription.updateMany({
      where: { id, organizationId },
      data,
    });
    if (count === 0) return null;
    const row = await prisma.costSubscription.findUniqueOrThrow({ where: { id } });
    return toDomainSubscription(row);
  }

  async deleteSubscription(organizationId: string, id: string): Promise<boolean> {
    const existing = await this.findSubscriptionById(organizationId, id);
    if (!existing) return false;
    await prisma.costSubscription.delete({ where: { id } });
    return true;
  }

  async hasUsageForSubscription(organizationId: string, subscriptionId: string): Promise<boolean> {
    const entry = await prisma.costUsageEntry.findFirst({
      where: { organizationId, subscriptionId },
      select: { id: true },
    });
    return entry !== null;
  }

  async listCatalog(organizationId: string): Promise<CostServiceCatalog[]> {
    // Globais (organizationId NULL) + customs da própria org (padrão Briefings).
    const rows = await prisma.costServiceCatalog.findMany({
      where: { isActive: true, OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return rows.map(toDomainCatalog);
  }

  async getSettings(organizationId: string): Promise<FinanceSettings> {
    const row = await prisma.financeSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
    return toDomainSettings(row);
  }

  async updateSettings(
    organizationId: string,
    data: UpdateFinanceSettingsInput,
  ): Promise<FinanceSettings> {
    const row = await prisma.financeSettings.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });
    return toDomainSettings(row);
  }

  countWonLeads(organizationId: string): Promise<number> {
    return prisma.lead.count({ where: { organizationId, status: "WON" } });
  }

  async listUsage(
    organizationId: string,
    range: { from: Date; to: Date },
  ): Promise<CostUsageEntry[]> {
    const rows = await prisma.costUsageEntry.findMany({
      where: { organizationId, usedAt: { gte: range.from, lt: range.to } },
      include: { company: { select: { name: true } } },
      orderBy: { usedAt: "desc" },
    });
    return rows.map(toDomainUsage);
  }

  async createUsage(
    organizationId: string,
    data: CreateUsageEntryInput & { unitPriceBrl: number | null },
  ): Promise<CostUsageEntry> {
    const row = await prisma.costUsageEntry.create({
      data: {
        organizationId,
        subscriptionId: data.subscriptionId,
        companyId: data.companyId ?? null,
        credits: data.credits,
        usedAt: data.usedAt,
        note: data.note ?? null,
        unitPriceBrl: data.unitPriceBrl,
      },
      include: { company: { select: { name: true } } },
    });
    return toDomainUsage(row);
  }

  async deleteUsage(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.costUsageEntry.findFirst({ where: { id, organizationId } });
    if (!existing) return false;
    await prisma.costUsageEntry.delete({ where: { id } });
    return true;
  }
}
