import type {
  CreateCostSubscriptionInput,
  CreateUsageEntryInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { CapacityEntry, CostSummary, CostUsageEntry, UsageSummary } from "../../domain/entities/cost.js";
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

interface UsageEntryForSummary {
  subscriptionId: string;
  companyId: string | null;
  companyName: string | null;
  credits: number;
}

interface UsageSubscription {
  id: string;
  name: string;
  amount: number | { toString(): string };
  currency: Currency;
  billingCycle: Cycle;
  creditsIncluded: number | null;
}

/** Preço unitário do crédito -- SEMPRE derivado (mensal BRL ÷ creditsIncluded),
 * null quando a assinatura não tem creditsIncluded. */
function unitPriceBrlFor(sub: UsageSubscription | undefined, usdRate: number): number | null {
  if (!sub || !sub.creditsIncluded) return null;
  return monthlyAmountBrl(Number(sub.amount), sub.currency, sub.billingCycle, usdRate) / sub.creditsIncluded;
}

/** Puro pra ser testável sem repo -- o service delega aqui. `month` é
 * responsabilidade do caller (getUsageSummary), que já filtrou `entries`
 * pelo período antes de chamar. */
export function computeUsageSummary(
  entries: readonly UsageEntryForSummary[],
  subscriptions: readonly UsageSubscription[],
  usdRate: number,
): Omit<UsageSummary, "month"> {
  const subsById = new Map(subscriptions.map((s) => [s.id, s]));

  const bySubMap = new Map<string, number>();
  for (const entry of entries) {
    bySubMap.set(entry.subscriptionId, (bySubMap.get(entry.subscriptionId) ?? 0) + entry.credits);
  }

  const bySubscription = Array.from(bySubMap.entries()).map(([subscriptionId, credits]) => {
    const sub = subsById.get(subscriptionId);
    const unitPriceBrl = unitPriceBrlFor(sub, usdRate);
    return {
      subscriptionId,
      name: sub?.name ?? "Assinatura removida",
      credits,
      creditsIncluded: sub?.creditsIncluded ?? null,
      unitPriceBrl,
      costBrl: unitPriceBrl != null ? credits * unitPriceBrl : 0,
    };
  });

  const byClientMap = new Map<string, { companyName: string; credits: number; costBrl: number }>();
  for (const entry of entries) {
    const key = entry.companyId ?? "";
    const unitPriceBrl = unitPriceBrlFor(subsById.get(entry.subscriptionId), usdRate) ?? 0;
    const acc = byClientMap.get(key) ?? {
      companyName: entry.companyId ? (entry.companyName ?? "") : "Sem cliente",
      credits: 0,
      costBrl: 0,
    };
    acc.credits += entry.credits;
    acc.costBrl += entry.credits * unitPriceBrl;
    byClientMap.set(key, acc);
  }

  const byClient = Array.from(byClientMap.entries()).map(([key, acc]) => ({
    companyId: key === "" ? null : key,
    companyName: acc.companyName,
    credits: acc.credits,
    costBrl: acc.costBrl,
  }));

  const totalCredits = entries.reduce((acc, e) => acc + e.credits, 0);
  // Só assume um preço unitário "de topo" quando é inequívoco (1 assinatura
  // com creditsIncluded usada no período) -- ver `bySubscription` pro detalhe.
  const unitPriceBrl = bySubscription.length === 1 ? bySubscription[0]!.unitPriceBrl : null;

  return { unitPriceBrl, totalCredits, bySubscription, byClient };
}

/** "YYYY-MM" do dia corrente no fuso informado (default America/Sao_Paulo). */
export function currentMonthInTimeZone(now: Date = new Date(), timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(
    now,
  );
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/** Intervalo [from, to) em UTC pra filtrar `usedAt` de um mês "YYYY-MM". */
function monthRangeUtc(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
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

  async listUsage(organizationId: string, month?: string): Promise<CostUsageEntry[]> {
    const { from, to } = monthRangeUtc(month ?? currentMonthInTimeZone());
    return this.repository.listUsage(organizationId, { from, to });
  }

  async createUsage(organizationId: string, input: CreateUsageEntryInput): Promise<CostUsageEntry> {
    const subscription = await this.repository.findSubscriptionById(organizationId, input.subscriptionId);
    if (!subscription) throw new NotFoundError("Assinatura não encontrada.");
    if (input.companyId) {
      const company = await this.companies.findByIdForOrg(input.companyId, organizationId);
      if (!company) throw new NotFoundError("Empresa não encontrada.");
    }
    return this.repository.createUsage(organizationId, input);
  }

  async deleteUsage(organizationId: string, id: string): Promise<void> {
    const ok = await this.repository.deleteUsage(organizationId, id);
    if (!ok) throw new NotFoundError("Lançamento de consumo não encontrado.");
  }

  async getUsageSummary(organizationId: string, month?: string): Promise<UsageSummary> {
    const resolvedMonth = month ?? currentMonthInTimeZone();
    const { from, to } = monthRangeUtc(resolvedMonth);
    const [entries, subscriptions, settings] = await Promise.all([
      this.repository.listUsage(organizationId, { from, to }),
      this.repository.listSubscriptions(organizationId),
      this.repository.getSettings(organizationId),
    ]);
    return {
      month: resolvedMonth,
      ...computeUsageSummary(entries, subscriptions, Number(settings.usdToBrlRate)),
    };
  }
}
