import type { EstimateStatus, CostCurrency, CostBillingCycle } from "@millead/database";

export interface HoursLine {
  label: string;
  hours: number;
}

export interface EstimateCostItem {
  id: string;
  organizationId: string;
  estimateId: string;
  subscriptionId: string | null;
  label: string;
  amount: string; // Decimal do Prisma serializa como string
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  /** Custo único (ex.: créditos de projeto) -- não multiplica por infraMonths. */
  isOneTime: boolean;
}

export interface PricingEstimateWithItems {
  id: string;
  organizationId: string;
  leadId: string | null;
  createdById: string;
  productId: string | null;
  proposalId: string | null;
  title: string;
  status: EstimateStatus;
  hourlyRate: string; // Decimal do Prisma serializa como string
  hoursBreakdown: HoursLine[];
  agencyShareMonthly: string; // Decimal do Prisma serializa como string
  infraMonths: number;
  supportReservePct: string; // Decimal do Prisma serializa como string
  marginPct: string; // Decimal do Prisma serializa como string
  scopeItems: string[];
  deadlineDays: number;
  paymentTerms: string;
  validDays: number;
  // Fase 6: preço final decidido pelo dono e domínio por anos -- ambos
  // opcionais, Decimal do Prisma serializa como string, null quando ausente.
  finalPrice: string | null;
  domainYears: number | null;
  domainYearPriceBrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  costItems: EstimateCostItem[];
}

export interface ProjectProduct {
  id: string;
  organizationId: string | null;
  name: string;
  priceMin: string; // Decimal do Prisma serializa como string
  priceMax: string; // Decimal do Prisma serializa como string
  baseHours: number | null;
  description: string | null;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
