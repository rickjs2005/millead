import { NotFoundError } from "../../domain/errors/app-error.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { PricingEstimateWithItems } from "../../domain/entities/estimate.js";
import type {
  CostItemInput,
  CreateEstimateInput,
  ListEstimatesQuery,
  UpdateEstimateInput,
} from "../dto/estimate.dto.js";
import { computeEstimate, type EstimateComputed } from "./estimate-calc.js";
import { computeSummary } from "./cost-service.js";

type EstimateWithComputed = PricingEstimateWithItems & { computed: EstimateComputed };

export class EstimateService {
  constructor(
    private readonly repository: EstimateRepository,
    private readonly costs: CostRepository,
    private readonly leads: LeadRepository,
  ) {}

  async list(
    organizationId: string,
    query: ListEstimatesQuery,
  ): Promise<{ items: EstimateWithComputed[]; total: number }> {
    const [result, settings] = await Promise.all([
      this.repository.list(organizationId, query),
      this.costs.getSettings(organizationId),
    ]);
    const usdToBrlRate = Number(settings.usdToBrlRate);
    return {
      items: result.items.map((item) => ({ ...item, computed: this.toComputed(item, usdToBrlRate) })),
      total: result.total,
    };
  }

  async get(organizationId: string, id: string): Promise<EstimateWithComputed> {
    const estimate = await this.repository.findById(organizationId, id);
    if (!estimate) throw new NotFoundError("Orçamento não encontrado.");
    return this.withComputed(estimate);
  }

  async create(
    organizationId: string,
    createdById: string,
    input: CreateEstimateInput,
  ): Promise<EstimateWithComputed> {
    await this.validateOwnership(organizationId, input);

    const agencyShareMonthly =
      input.agencyShareMonthly ?? (await this.defaultAgencyShareMonthly(organizationId));

    const estimate = await this.repository.create(organizationId, createdById, {
      ...input,
      agencyShareMonthly,
    });
    return this.withComputed(estimate);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateEstimateInput,
  ): Promise<EstimateWithComputed> {
    await this.validateOwnership(organizationId, input);

    const estimate = await this.repository.update(organizationId, id, input);
    if (!estimate) throw new NotFoundError("Orçamento não encontrado.");
    return this.withComputed(estimate);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const ok = await this.repository.delete(organizationId, id);
    if (!ok) throw new NotFoundError("Orçamento não encontrado.");
  }

  listProducts(organizationId: string) {
    return this.repository.listProducts(organizationId);
  }

  /**
   * Ownership de leadId/productId/subscriptionId -- roda ANTES de gravar
   * qualquer coisa. `null`/`undefined` pulam a validação (é assim que
   * update com `leadId: null` desvincula sem checar org); string sempre valida.
   */
  private async validateOwnership(
    organizationId: string,
    input: Partial<CreateEstimateInput>,
  ): Promise<void> {
    if (input.leadId) {
      const lead = await this.leads.findByIdForOrg(input.leadId, organizationId);
      if (!lead) throw new NotFoundError("Lead não encontrado.");
    }

    if (input.productId) {
      const products = await this.repository.listProducts(organizationId);
      const exists = products.some((p) => p.id === input.productId);
      if (!exists) throw new NotFoundError("Produto não encontrado.");
    }

    if (input.costItems) {
      const subscriptionIds = input.costItems
        .map((item: CostItemInput) => item.subscriptionId)
        .filter((id): id is string => Boolean(id));
      if (subscriptionIds.length > 0) {
        const subscriptions = await this.costs.listSubscriptions(organizationId);
        const validIds = new Set(subscriptions.map((s) => s.id));
        for (const subscriptionId of subscriptionIds) {
          if (!validIds.has(subscriptionId)) {
            throw new NotFoundError("Assinatura de custo não encontrada.");
          }
        }
      }
    }
  }

  /** Sem `agencyShareMonthly` explícito no CREATE, usa o rateio atual (mesma conta do resumo de custos). */
  private async defaultAgencyShareMonthly(organizationId: string): Promise<number> {
    const [subscriptions, settings, wonLeadsCount] = await Promise.all([
      this.costs.listSubscriptions(organizationId),
      this.costs.getSettings(organizationId),
      this.costs.countWonLeads(organizationId),
    ]);
    const summary = computeSummary(
      subscriptions.map((s) => ({
        scope: s.scope,
        amount: Number(s.amount),
        currency: s.currency,
        billingCycle: s.billingCycle,
        isActive: s.isActive,
      })),
      { usdToBrlRate: Number(settings.usdToBrlRate), activeClientsCount: settings.activeClientsCount },
      wonLeadsCount,
    );
    return summary.perClientShareBrl;
  }

  private async withComputed(estimate: PricingEstimateWithItems): Promise<EstimateWithComputed> {
    const settings = await this.costs.getSettings(estimate.organizationId);
    return { ...estimate, computed: this.toComputed(estimate, Number(settings.usdToBrlRate)) };
  }

  private toComputed(estimate: PricingEstimateWithItems, usdToBrlRate: number): EstimateComputed {
    return computeEstimate({
      hourlyRate: Number(estimate.hourlyRate),
      hoursBreakdown: estimate.hoursBreakdown,
      costItems: estimate.costItems.map((item) => ({
        amount: Number(item.amount),
        currency: item.currency,
        billingCycle: item.billingCycle,
      })),
      agencyShareMonthly: Number(estimate.agencyShareMonthly),
      infraMonths: estimate.infraMonths,
      supportReservePct: Number(estimate.supportReservePct),
      marginPct: Number(estimate.marginPct),
      usdToBrlRate,
    });
  }
}
