import type {
  CreateCostSubscriptionInput,
  CreateUsageEntryInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type {
  CapacityEntry,
  CostSubscription,
  CostSummary,
  CostUsageEntry,
  FinanceSettings,
  UsageSummary,
} from "../../domain/entities/cost.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";

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

/** Ponte entre as entidades do repositório (Decimal-as-string) e
 * `computeSummary` -- extraída pra ser reusada por `getSummary` e
 * `getUsageSeries` (que precisa do mesmo resumo mas já buscou `subscriptions`
 * e `settings` sozinho, então NÃO chama `getSummary` de novo -- isso evitaria
 * um segundo `listSubscriptions`/refresh de cotação redundante por request). */
function buildSummary(
  subscriptions: readonly CostSubscription[],
  settings: Pick<FinanceSettings, "usdToBrlRate" | "activeClientsCount">,
  wonLeadsCount: number,
): CostSummary {
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
    wonLeadsCount,
  );
}

interface UsageEntryForSummary {
  subscriptionId: string;
  companyId: string | null;
  companyName: string | null;
  credits: number;
  /** Snapshot gravado no lançamento; null = lançamento antigo, cai no
   * fallback derivado ao vivo (ver `unitPriceBrlFor`). */
  unitPriceBrl: number | null;
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

/** Custo em BRL de UM lançamento -- usa o preço GRAVADO no momento
 * (snapshot); só cai pro preço ao vivo da assinatura em lançamentos antigos
 * que não tinham snapshot. Isso evita que trocar o preço da assinatura ou o
 * câmbio da org reescreva retroativamente o custo de um mês já fechado.
 * Extraída pra ser reusada por `computeUsageSummary` e `getUsageSeries` --
 * MESMA regra nos dois lugares, sem duplicar. */
export function entryCostBrl(
  entry: Pick<UsageEntryForSummary, "credits" | "unitPriceBrl">,
  subscription: UsageSubscription | undefined,
  usdRate: number,
): number {
  const unitPrice = entry.unitPriceBrl ?? unitPriceBrlFor(subscription, usdRate);
  return unitPrice != null ? entry.credits * unitPrice : 0;
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
  const costOf = (entry: UsageEntryForSummary): number =>
    entryCostBrl(entry, subsById.get(entry.subscriptionId), usdRate);

  const bySubMap = new Map<string, { credits: number; costBrl: number }>();
  for (const entry of entries) {
    const acc = bySubMap.get(entry.subscriptionId) ?? { credits: 0, costBrl: 0 };
    acc.credits += entry.credits;
    acc.costBrl += costOf(entry);
    bySubMap.set(entry.subscriptionId, acc);
  }

  const bySubscription = Array.from(bySubMap.entries()).map(([subscriptionId, agg]) => {
    const sub = subsById.get(subscriptionId);
    return {
      subscriptionId,
      name: sub?.name ?? "Assinatura removida",
      credits: agg.credits,
      creditsIncluded: sub?.creditsIncluded ?? null,
      // Preço ATUAL da assinatura, só informativo -- o custo somado acima
      // (`costBrl`) já reflete o preço de cada lançamento na hora dele.
      unitPriceBrl: unitPriceBrlFor(sub, usdRate),
      costBrl: agg.costBrl,
    };
  });

  const byClientMap = new Map<string, { companyName: string; credits: number; costBrl: number }>();
  for (const entry of entries) {
    const key = entry.companyId ?? "";
    const acc = byClientMap.get(key) ?? {
      companyName: entry.companyId ? (entry.companyName ?? "") : "Sem cliente",
      credits: 0,
      costBrl: 0,
    };
    acc.credits += entry.credits;
    acc.costBrl += costOf(entry);
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

/**
 * `usedAt` é DATE-ONLY: vem de `<input type="date">` no front
 * (credit-usage-section.tsx) e é coagido por `z.coerce.date()` (ver
 * cost.dto.ts) pra SEMPRE `YYYY-MM-DDT00:00:00Z` -- não existe "hora de
 * Brasília" pra essa data, é só um dia do calendário. Por isso o corte de
 * mês aqui fica em meia-noite UTC pura, de propósito -- NÃO é um lugar
 * esquecido do fix de fuso (esse fix mexeu em `receivable-service.ts`
 * `paidAt`/`contract-kpis-range.ts` `assinadoEm`, que são timestamps reais).
 * Aplicar corte de Brasília aqui empurraria todo lançamento do dia 1
 * (`usedAt` = meia-noite UTC do dia 1) pro mês anterior.
 */
function monthRangeUtc(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

/** Lista N chaves "YYYY-MM" em ordem cronológica ascendente terminando em
 * `endMonth` (inclusive) -- monta o eixo X zero-filled da série (mesmo
 * padrão do receivable-service). */
function monthKeysAsc(endMonth: string, count: number): string[] {
  const [yearStr, monthStr] = endMonth.split("-");
  let year = Number(yearStr);
  let monthIndex = Number(monthStr) - 1; // 0-based
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }
  return keys.reverse();
}

/** Chave "YYYY-MM" de `usedAt` em UTC puro -- mesmo critério de
 *  `monthRangeUtc` (date-only, sem fuso -- ver comentário acima). */
function monthKeyUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Ponto da série mensal de consumo -- custo em BRL já resolvido (snapshot
 * ou derivado, ver `entryCostBrl`). */
export interface CostUsageSeriesPoint {
  month: string;
  usageCostBrl: number;
}

export interface CostUsageSeries {
  months: CostUsageSeriesPoint[]; // exatamente N entradas, ordem cronológica asc, zero-fill
  yearTotal: number; // consumo do ano corrente
  recurringMonthlyBrl: number; // totalMonthlyBrl atual (mesma conta do getSummary)
}

// ---------------------------------------------------------------------------
// Cotação USD-BRL automática (refresh lazy no read)
// ---------------------------------------------------------------------------

/** Decide se a cotação persistida está velha o bastante pra buscar de novo.
 * Pura pra ser testável sem repo/rede. Regra: só entra em jogo com
 * `usdRateAuto` ligado; sem timestamp (nunca buscou) ou com mais de 24h. */
export function needsUsdRateRefresh(
  settings: Pick<FinanceSettings, "usdRateAuto" | "usdRateUpdatedAt">,
  now: Date = new Date(),
): boolean {
  if (!settings.usdRateAuto) return false;
  if (!settings.usdRateUpdatedAt) return true;
  const ageMs = now.getTime() - new Date(settings.usdRateUpdatedAt).getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

/** Valida o `USDBRL.bid` da AwesomeAPI: precisa ser numérico e cair num
 * intervalo plausível (1..20) -- sanidade contra API fora do ar devolvendo
 * lixo/HTML ou um valor absurdo que estragaria todo o financeiro. Pura pra
 * ser testável sem rede. */
export function parseUsdRateBid(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const bid = Number(raw);
  if (!Number.isFinite(bid)) return null;
  if (bid < 1 || bid > 20) return null;
  return bid;
}

/** Contrato do fetcher de cotação: nunca lança -- resolve o bid válido ou
 * `null` (falha de rede, timeout, resposta inválida, bid fora de sanidade).
 * Injetável no construtor do `CostService` pra testar sem rede. */
export type UsdRateFetcher = () => Promise<number | null>;

/** Implementação padrão: AwesomeAPI, timeout de 3s via AbortController.
 * Nunca lança -- qualquer falha vira `null` (o service decide o log e o
 * fallback pro valor persistido). */
export async function defaultUsdRateFetcher(): Promise<number | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { USDBRL?: { bid?: unknown } };
    return parseUsdRateBid(data.USDBRL?.bid);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export class CostService {
  constructor(
    private readonly repository: CostRepository,
    private readonly companies: CompanyRepository,
    private readonly rateFetcher: UsdRateFetcher = defaultUsdRateFetcher,
  ) {}

  /** Ponto ÚNICO de leitura de `FinanceSettings` -- TODO fluxo que precisa de
   * settings (getSettings, getSummary, getUsageSummary, getUsageSeries,
   * createUsage) passa por aqui, garantindo que o refresh lazy da cotação
   * (`needsUsdRateRefresh`) cubra a aplicação inteira a partir de um único
   * lugar. Falha do fetcher NUNCA propaga -- loga e devolve o valor
   * persistido (fallback), como exige a regra de negócio.
   *
   * Concorrência: duas leituras simultâneas com cotação velha podem disparar
   * 2 fetches em paralelo (sem lock) -- aceitável (RENDER free/lazy, custo
   * baixo, pior caso é uma chamada HTTP a mais). O segundo `updateSettings`
   * é um upsert por `organizationId` único: não conflita, só sobrescreve —
   * nunca lança por causa da corrida. */
  private async readSettings(organizationId: string): Promise<FinanceSettings> {
    const settings = await this.repository.getSettings(organizationId);
    if (!needsUsdRateRefresh(settings)) return settings;

    let rate: number | null;
    try {
      rate = await this.rateFetcher();
    } catch (err) {
      console.warn(`[cost-service] falha ao buscar cotação USD-BRL (org ${organizationId}):`, err);
      return settings;
    }
    if (rate == null) {
      console.warn(
        `[cost-service] cotação USD-BRL indisponível/inválida (org ${organizationId}) -- mantendo valor persistido.`,
      );
      return settings;
    }

    return this.repository.updateSettings(organizationId, {
      usdToBrlRate: rate,
      usdRateUpdatedAt: new Date(),
    });
  }

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
    // Apagar de verdade cascateia e destrói o histórico de CostUsageEntry
    // (créditos consumidos por cliente, possivelmente já cobrado) -- se
    // houver uso registrado, o caminho é desativar (isActive: false), não
    // apagar.
    const hasUsage = await this.repository.hasUsageForSubscription(organizationId, id);
    if (hasUsage) {
      throw new ConflictError(
        "Esta assinatura tem lançamentos de uso/crédito registrados -- desative em vez de excluir, pra não perder o histórico.",
      );
    }
    const ok = await this.repository.deleteSubscription(organizationId, id);
    if (!ok) throw new NotFoundError("Assinatura não encontrada");
  }

  listCatalog(organizationId: string) {
    return this.repository.listCatalog(organizationId);
  }

  getSettings(organizationId: string) {
    return this.readSettings(organizationId);
  }

  /** PATCH de settings. Regra de negócio: setar `usdToBrlRate` na mão é um
   * pedido implícito de "quero controlar isso" -- desliga `usdRateAuto`
   * sozinho, A NÃO SER que o mesmo PATCH já traga `usdRateAuto` explícito
   * (nesse caso o explícito vence, ex.: religar auto e mandar um valor
   * inicial no mesmo request). Também grava `usdRateUpdatedAt` = agora nesse
   * caso, pra edição manual contar como "atualização" e não ser
   * imediatamente sobrescrita por um refresh automático faminho por 24h. */
  updateSettings(organizationId: string, input: UpdateFinanceSettingsInput) {
    const data: UpdateFinanceSettingsInput & { usdRateUpdatedAt?: Date } = { ...input };
    if (data.usdToBrlRate !== undefined) {
      if (data.usdRateAuto === undefined) data.usdRateAuto = false;
      data.usdRateUpdatedAt = new Date();
    }
    return this.repository.updateSettings(organizationId, data);
  }

  async getSummary(organizationId: string): Promise<CostSummary> {
    const [subscriptions, settings, wonLeads] = await Promise.all([
      this.repository.listSubscriptions(organizationId),
      this.readSettings(organizationId),
      this.repository.countWonLeads(organizationId),
    ]);
    return buildSummary(subscriptions, settings, wonLeads);
  }

  async listUsage(organizationId: string, month?: string): Promise<CostUsageEntry[]> {
    const { from, to } = monthRangeUtc(month ?? currentMonthInTimeZone());
    return this.repository.listUsage(organizationId, { from, to });
  }

  async createUsage(organizationId: string, input: CreateUsageEntryInput): Promise<CostUsageEntry> {
    const subscription = await this.repository.findSubscriptionById(organizationId, input.subscriptionId);
    if (!subscription) throw new NotFoundError("Assinatura não encontrada.");
    if (!subscription.creditsIncluded) {
      // Sem creditsIncluded não dá pra derivar preço/crédito -- aceitar
      // mesmo assim faria o lançamento custar R$0 silenciosamente em todo
      // resumo (a UI já filtra isso no seletor, mas a API não travava).
      throw new ValidationError(
        "Esta assinatura não tem 'créditos incluídos' configurado -- defina antes de lançar consumo.",
      );
    }
    if (input.companyId) {
      const company = await this.companies.findByIdForOrg(input.companyId, organizationId);
      if (!company) throw new NotFoundError("Empresa não encontrada.");
    }
    // Preço gravado NA HORA -- ver o comentário em `unitPriceBrl` na
    // migration/entidade: garante que o custo deste lançamento não mude
    // retroativamente se a assinatura ou o câmbio mudarem depois.
    const settings = await this.readSettings(organizationId);
    const unitPriceBrl = unitPriceBrlFor(subscription, Number(settings.usdToBrlRate));
    return this.repository.createUsage(organizationId, { ...input, unitPriceBrl });
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
      this.readSettings(organizationId),
    ]);
    return {
      month: resolvedMonth,
      ...computeUsageSummary(entries, subscriptions, Number(settings.usdToBrlRate)),
    };
  }

  /** Série mensal (últimos `months`, default 12) de custo de consumo, mais o
   * total do ano corrente e o recorrente mensal atual -- alimenta gráfico de
   * consumo. Mesmo padrão de janela do `ReceivableService.series`. */
  async getUsageSeries(organizationId: string, months = 12): Promise<CostUsageSeries> {
    const currentMonth = currentMonthInTimeZone();
    const keys = monthKeysAsc(currentMonth, months);
    const { from } = monthRangeUtc(keys[0]!);
    const { to } = monthRangeUtc(currentMonth);

    const currentYear = Number(currentMonth.split("-")[0]);
    const yearFrom = new Date(Date.UTC(currentYear, 0, 1));
    const yearTo = new Date(Date.UTC(currentYear + 1, 0, 1));

    // A janela de busca precisa cobrir tanto os N meses da série quanto o
    // ano corrente inteiro -- quando months < 12 (ou o ano corrente
    // extrapola pro passado dos N meses), um intervalo não contém o outro.
    const queryFrom = from < yearFrom ? from : yearFrom;
    const queryTo = to > yearTo ? to : yearTo;

    // UMA chamada cobrindo a janela inteira -- listUsage já aceita range.
    // `wonLeads` só entra pro resumo recorrente (`buildSummary` abaixo) --
    // reusar `subscriptions`/`settings` já buscados aqui em vez de chamar
    // `this.getSummary` de novo evita um segundo `listSubscriptions` E um
    // segundo refresh lazy de cotação por request (ver `readSettings`).
    const [entries, subscriptions, settings, wonLeads] = await Promise.all([
      this.repository.listUsage(organizationId, { from: queryFrom, to: queryTo }),
      this.repository.listSubscriptions(organizationId),
      this.readSettings(organizationId),
      this.repository.countWonLeads(organizationId),
    ]);
    const summary = buildSummary(subscriptions, settings, wonLeads);

    const usdRate = Number(settings.usdToBrlRate);
    const subsById = new Map(subscriptions.map((s) => [s.id, s]));

    const buckets = new Map<string, number>();
    for (const key of keys) buckets.set(key, 0);

    let yearTotal = 0;

    for (const entry of entries) {
      const cost = entryCostBrl(entry, subsById.get(entry.subscriptionId), usdRate);

      const bucketKey = monthKeyUtc(entry.usedAt);
      const bucket = buckets.get(bucketKey);
      if (bucket !== undefined) buckets.set(bucketKey, bucket + cost);

      if (entry.usedAt >= yearFrom && entry.usedAt < yearTo) yearTotal += cost;
    }

    return {
      months: keys.map((key) => ({ month: key, usageCostBrl: buckets.get(key)! })),
      yearTotal,
      recurringMonthlyBrl: summary.totalMonthlyBrl,
    };
  }
}
