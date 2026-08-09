import type { CostScope, CostCurrency, CostBillingCycle, CostCategory } from "@millead/database";

export interface CostSubscription {
  id: string;
  organizationId: string;
  companyId: string | null;
  serviceKey: string | null;
  name: string;
  scope: CostScope;
  amount: string; // Decimal do Prisma serializa como string
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  capacityLimit: number | null;
  capacityUsed: number | null;
  creditsIncluded: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CostServiceCatalog {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  category: CostCategory;
  defaultAmount: string; // Decimal do Prisma serializa como string
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  defaultScope: CostScope;
  defaultCapacityLimit: number | null;
  bestFor: string | null;
  billingNotes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinanceSettings {
  id: string;
  organizationId: string;
  usdToBrlRate: string; // Decimal do Prisma serializa como string
  /** true = `usdToBrlRate` é atualizado sozinho (lazy, no read) quando
   * `usdRateUpdatedAt` for null ou tiver mais de 24h; editar `usdToBrlRate`
   * na mão desliga isso automaticamente (ver `CostService.updateSettings`). */
  usdRateAuto: boolean;
  /** Timestamp da última atualização (manual ou automática) de `usdToBrlRate`. */
  usdRateUpdatedAt: Date | null;
  defaultHourlyRate: string; // Decimal do Prisma serializa como string
  supportReservePct: string; // Decimal do Prisma serializa como string
  defaultMarginPct: string; // Decimal do Prisma serializa como string
  activeClientsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Uma assinatura com capacidade (ex.: tokens/mês) aproximando do limite. */
export interface CapacityEntry {
  id: string;
  name: string;
  used: number;
  limit: number;
  /** 0-999, arredondado, = round(used/limit*100). */
  pct: number;
}

/** Resumo financeiro da org -- números já convertidos pra BRL/mês. */
export interface CostSummary {
  agencyMonthlyBrl: number;
  clientMonthlyBrl: number;
  totalMonthlyBrl: number;
  perClientShareBrl: number;
  activeClientsCount: number;
  /** Sugestão exibida ao lado do campo manual. */
  wonLeadsCount: number;
  activeSubscriptions: number;
  /** Só assinaturas ativas com used/limit definidos e limit>0, ordenadas por pct desc. */
  capacity: CapacityEntry[];
  /** Maior pct entre as entradas de capacity; null quando capacity está vazia. */
  maxCapacityPct: number | null;
}

/** Lançamento de consumo de créditos (Fase 5) -- `companyName` já vem
 * denormalizado da leitura (join com Company), null quando sem cliente. */
export interface CostUsageEntry {
  id: string;
  organizationId: string;
  subscriptionId: string;
  companyId: string | null;
  companyName: string | null;
  credits: number;
  usedAt: Date;
  note: string | null;
  createdAt: Date;
  /** Snapshot do preço/crédito em BRL no momento do lançamento; null em
   * lançamentos antigos ou quando a assinatura não tinha creditsIncluded
   * na hora -- nesses casos o resumo cai no fallback derivado ao vivo. */
  unitPriceBrl: number | null;
}

/** Resumo de consumo de créditos de um mês (`GET /costs/usage/summary`). */
export interface UsageSummary {
  month: string; // "2026-07"
  /** Preço unitário quando há exatamente 1 assinatura com creditsIncluded
   * usada no mês (caso comum hoje: só o Higgsfield); null se ambíguo/nenhum
   * -- ver o detalhe por assinatura em `bySubscription`. */
  unitPriceBrl: number | null;
  totalCredits: number;
  bySubscription: {
    subscriptionId: string;
    name: string;
    credits: number;
    creditsIncluded: number | null;
    unitPriceBrl: number | null;
    costBrl: number;
  }[];
  /** companyId null => "Sem cliente". */
  byClient: { companyId: string | null; companyName: string; credits: number; costBrl: number }[];
}
