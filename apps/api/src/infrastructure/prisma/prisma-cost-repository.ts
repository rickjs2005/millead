import { prisma } from "@millead/database";
import type {
  CreateCostSubscriptionInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../../application/dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSubscription, CostServiceCatalog, FinanceSettings } from "../../domain/entities/cost.js";

export class PrismaCostRepository implements CostRepository {
  listSubscriptions(organizationId: string): Promise<CostSubscription[]> {
    return prisma.costSubscription.findMany({
      where: { organizationId },
      orderBy: [{ scope: "asc" }, { isActive: "desc" }, { name: "asc" }],
    });
  }

  findSubscriptionById(organizationId: string, id: string): Promise<CostSubscription | null> {
    return prisma.costSubscription.findFirst({ where: { id, organizationId } });
  }

  createSubscription(
    organizationId: string,
    data: CreateCostSubscriptionInput,
  ): Promise<CostSubscription> {
    return prisma.costSubscription.create({ data: { ...data, organizationId } });
  }

  async updateSubscription(
    organizationId: string,
    id: string,
    data: UpdateCostSubscriptionInput,
  ): Promise<CostSubscription | null> {
    const existing = await this.findSubscriptionById(organizationId, id);
    if (!existing) return null;
    return prisma.costSubscription.update({ where: { id }, data });
  }

  async deleteSubscription(organizationId: string, id: string): Promise<boolean> {
    const existing = await this.findSubscriptionById(organizationId, id);
    if (!existing) return false;
    await prisma.costSubscription.delete({ where: { id } });
    return true;
  }

  listCatalog(organizationId: string): Promise<CostServiceCatalog[]> {
    // Globais (organizationId NULL) + customs da própria org (padrão Briefings).
    return prisma.costServiceCatalog.findMany({
      where: { isActive: true, OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async getSettings(organizationId: string): Promise<FinanceSettings> {
    return prisma.financeSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  updateSettings(
    organizationId: string,
    data: UpdateFinanceSettingsInput,
  ): Promise<FinanceSettings> {
    return prisma.financeSettings.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });
  }

  countWonLeads(organizationId: string): Promise<number> {
    return prisma.lead.count({ where: { organizationId, status: "WON" } });
  }
}
