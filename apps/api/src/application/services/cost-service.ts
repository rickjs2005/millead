import type {
  CreateCostSubscriptionInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { CapacityEntry, CostSummary } from "../../domain/entities/cost.js";
import { NotFoundError } from "../../domain/errors/app-error.js";

type Currency = "BRL" | "USD";
type Cycle = "MONTHLY" | "YEARLY";

/** Normaliza qualquer custo pra BRL/mês. Números JS bastam: valores pequenos e exibidos arredondados. */
export function monthlyAmountBrl(
  amount: number,
  currency: Currency,
  billingCycle: Cycle,
  usdToBrlRate: number,
): number {
  const brl = currency === "USD" ? amount * usdToBrlRate : amount;
  return billingCycle === "YEARLY" ? brl / 12 : brl;
}

interface SummarySubscription {
  id: string;
  name: string;
  scope: "AGENCY" | "CLIENT";
  amount: number | { toString(): string };
  currency: Currency;
  billingCycle: Cycle;
  isActive: boolean;
  capacityUsed: number | null;
  capacityLimit: number | null;
}

interface CapacitySubscription {
  id: string;
  name: string;
  isActive: boolean;
  capacityUsed: number | null;
  capacityLimit: number | null;
}

/** Puro pra ser testável sem repo -- só assinaturas ativas com used/limit definidos
 * e limit>0 entram na lista, ordenadas por pct desc. */
export function computeCapacity(
  subscriptions: readonly CapacitySubscription[],
): { capacity: CapacityEntry[]; maxCapacityPct: number | null } {
  const capacity = subscriptions
    .filter(
      (s): s is CapacitySubscription & { capacityUsed: number; capacityLimit: number } =>
        s.isActive && s.capacityUsed != null && s.capacityLimit != null && s.capacityLimit > 0,
    )
    .map((s) => ({
      id: s.id,
      name: s.name,
      used: s.capacityUsed,
      limit: s.capacityLimit,
      pct: Math.round((s.capacityUsed / s.capacityLimit) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);

  return {
    capacity,
    maxCapacityPct: capacity.length > 0 ? Math.max(...capacity.map((c) => c.pct)) : null,
  };
}

/** Puro pra ser testável sem repo -- o service delega aqui. */
export function computeSummary(
  subscriptions: readonly SummarySubscription[],
  settings: { usdToBrlRate: number | { toString(): string }; activeClientsCount: number },
  wonLeadsCount: number,
): CostSummary {
  const rate = Number(settings.usdToBrlRate);
  const active = subscriptions.filter((s) => s.isActive);
  const sum = (scope: "AGENCY" | "CLIENT") =>
    active
      .filter((s) => s.scope === scope)
      .reduce((acc, s) => acc + monthlyAmountBrl(Number(s.amount), s.currency, s.billingCycle, rate), 0);

  const agencyMonthlyBrl = sum("AGENCY");
  const clientMonthlyBrl = sum("CLIENT");
  const clients = Math.max(settings.activeClientsCount, 1);
  const { capacity, maxCapacityPct } = computeCapacity(subscriptions);
  return {
    agencyMonthlyBrl,
    clientMonthlyBrl,
    totalMonthlyBrl: agencyMonthlyBrl + clientMonthlyBrl,
    perClientShareBrl: agencyMonthlyBrl / clients,
    activeClientsCount: settings.activeClientsCount,
    wonLeadsCount,
    activeSubscriptions: active.length,
    capacity,
    maxCapacityPct,
  };
}

export class CostService {
  constructor(
    private readonly repository: CostRepository,
    private readonly companies: CompanyRepository,
  ) {}

  listSubscriptions(organizationId: string) {
    return this.repository.listSubscriptions(organizationId);
  }

  async createSubscription(organizationId: string, input: CreateCostSubscriptionInput) {
    if (input.companyId) {
      const company = await this.companies.findByIdForOrg(input.companyId, organizationId);
      if (!company) throw new NotFoundError("Empresa não encontrada.");
    }
    return this.repository.createSubscription(organizationId, input);
  }

  async updateSubscription(organizationId: string, id: string, input: UpdateCostSubscriptionInput) {
    if (input.companyId) {
      const company = await this.companies.findByIdForOrg(input.companyId, organizationId);
      if (!company) throw new NotFoundError("Empresa não encontrada.");
    }
    const updated = await this.repository.updateSubscription(organizationId, id, input);
    if (!updated) throw new NotFoundError("Assinatura não encontrada");
    return updated;
  }

  async deleteSubscription(organizationId: string, id: string) {
    const ok = await this.repository.deleteSubscription(organizationId, id);
    if (!ok) throw new NotFoundError("Assinatura não encontrada");
  }

  listCatalog(organizationId: string) {
    return this.repository.listCatalog(organizationId);
  }

  getSettings(organizationId: string) {
    return this.repository.getSettings(organizationId);
  }

  updateSettings(organizationId: string, input: UpdateFinanceSettingsInput) {
    return this.repository.updateSettings(organizationId, input);
  }

  async getSummary(organizationId: string): Promise<CostSummary> {
    const [subscriptions, settings, wonLeads] = await Promise.all([
      this.repository.listSubscriptions(organizationId),
      this.repository.getSettings(organizationId),
      this.repository.countWonLeads(organizationId),
    ]);
    return computeSummary(
      subscriptions.map((s) => ({
        id: s.id,
        name: s.name,
        scope: s.scope,
        amount: Number(s.amount),
        currency: s.currency,
        billingCycle: s.billingCycle,
        isActive: s.isActive,
        capacityUsed: s.capacityUsed,
        capacityLimit: s.capacityLimit,
      })),
      { usdToBrlRate: Number(settings.usdToBrlRate), activeClientsCount: settings.activeClientsCount },
      wonLeads,
    );
  }
}
