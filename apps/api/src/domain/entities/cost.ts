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
