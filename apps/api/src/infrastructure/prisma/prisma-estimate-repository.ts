import { prisma, Prisma, type EstimateStatus } from "@millead/database";
import type { CreateEstimateInput, UpdateEstimateInput } from "../../application/dto/estimate.dto.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type {
  EstimateCostItem,
  HoursLine,
  PricingEstimateWithItems,
  ProjectProduct,
} from "../../domain/entities/estimate.js";
import { toSkipTake } from "../../shared/pagination.js";

const withCostItems = { costItems: true };

type PricingEstimateRow = Prisma.PricingEstimateGetPayload<{ include: typeof withCostItems }>;

function toDomainCostItem(row: PricingEstimateRow["costItems"][number]): EstimateCostItem {
  return { ...row, amount: row.amount.toString() };
}

function toDomainEstimate(row: PricingEstimateRow): PricingEstimateWithItems {
  return {
    ...row,
    hourlyRate: row.hourlyRate.toString(),
    agencyShareMonthly: row.agencyShareMonthly.toString(),
    supportReservePct: row.supportReservePct.toString(),
    marginPct: row.marginPct.toString(),
    finalPrice: row.finalPrice ? row.finalPrice.toString() : null,
    domainYearPriceBrl: row.domainYearPriceBrl ? row.domainYearPriceBrl.toString() : null,
    hoursBreakdown: (row.hoursBreakdown as unknown as HoursLine[]) ?? [],
    scopeItems: (row.scopeItems as unknown as string[]) ?? [],
    costItems: row.costItems.map(toDomainCostItem),
  };
}

interface ProjectProductRow {
  id: string;
  organizationId: string | null;
  name: string;
  priceMin: Prisma.Decimal;
  priceMax: Prisma.Decimal;
  baseHours: number | null;
  description: string | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toDomainProduct(row: ProjectProductRow): ProjectProduct {
  return { ...row, priceMin: row.priceMin.toString(), priceMax: row.priceMax.toString() };
}

export class PrismaEstimateRepository implements EstimateRepository {
  async list(
    organizationId: string,
    params: { status?: EstimateStatus; page: number; pageSize: number },
  ): Promise<{ items: PricingEstimateWithItems[]; total: number }> {
    const where: Prisma.PricingEstimateWhereInput = {
      organizationId,
      ...(params.status ? { status: params.status } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.pricingEstimate.findMany({
        where,
        include: withCostItems,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(params),
      }),
      prisma.pricingEstimate.count({ where }),
    ]);
    return { items: rows.map(toDomainEstimate), total };
  }

  async findById(organizationId: string, id: string): Promise<PricingEstimateWithItems | null> {
    const row = await prisma.pricingEstimate.findFirst({
      where: { id, organizationId },
      include: withCostItems,
    });
    return row ? toDomainEstimate(row) : null;
  }

  async create(
    organizationId: string,
    createdById: string,
    data: CreateEstimateInput,
  ): Promise<PricingEstimateWithItems> {
    const { leadId, productId, costItems, ...rest } = data;
    const row = await prisma.pricingEstimate.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        leadId: leadId ?? null,
        productId: productId ?? null,
        hoursBreakdown: rest.hoursBreakdown,
        scopeItems: rest.scopeItems,
        costItems: {
          createMany: {
            data: costItems.map((item) => ({
              organizationId,
              label: item.label,
              amount: item.amount,
              currency: item.currency,
              billingCycle: item.billingCycle,
              subscriptionId: item.subscriptionId ?? null,
              isOneTime: item.isOneTime,
            })),
          },
        },
      },
      include: withCostItems,
    });
    return toDomainEstimate(row);
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateEstimateInput,
  ): Promise<PricingEstimateWithItems | null> {
    const { costItems, ...patch } = data;
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.pricingEstimate.updateMany({
        where: { id, organizationId },
        data: patch,
      });
      if (count === 0) return null;

      // Update parcial sem `costItems` no payload não mexe nos itens já
      // gravados -- só substitui o snapshot inteiro quando o campo vem.
      if (costItems) {
        await tx.pricingEstimateCost.deleteMany({ where: { estimateId: id } });
        if (costItems.length > 0) {
          await tx.pricingEstimateCost.createMany({
            data: costItems.map((item) => ({
              organizationId,
              estimateId: id,
              label: item.label,
              amount: item.amount,
              currency: item.currency,
              billingCycle: item.billingCycle,
              subscriptionId: item.subscriptionId ?? null,
              isOneTime: item.isOneTime,
            })),
          });
        }
      }

      const row = await tx.pricingEstimate.findUniqueOrThrow({
        where: { id },
        include: withCostItems,
      });
      return toDomainEstimate(row);
    });
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const existing = await prisma.pricingEstimate.findFirst({ where: { id, organizationId } });
    if (!existing) return false;
    await prisma.pricingEstimate.delete({ where: { id } });
    return true;
  }

  async markConverted(organizationId: string, id: string, proposalId: string): Promise<void> {
    await prisma.pricingEstimate.updateMany({
      where: { id, organizationId },
      data: { status: "CONVERTED", proposalId },
    });
  }

  async listProducts(organizationId: string): Promise<ProjectProduct[]> {
    const rows = await prisma.projectProduct.findMany({
      where: { isActive: true, OR: [{ organizationId: null }, { organizationId }] },
      orderBy: { order: "asc" },
    });
    return rows.map(toDomainProduct);
  }
}
