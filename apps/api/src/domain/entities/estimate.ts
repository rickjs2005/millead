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
