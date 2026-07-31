import { monthlyAmountBrl } from "./cost-service.js";

type Currency = "BRL" | "USD";
type Cycle = "MONTHLY" | "YEARLY";

export interface EstimateCalcInput {
  hourlyRate: number;
  hoursBreakdown: { label: string; hours: number }[];
  costItems: { amount: number; currency: Currency; billingCycle: Cycle }[];
  agencyShareMonthly: number;
  infraMonths: number;
  supportReservePct: number;
  marginPct: number;
  usdToBrlRate: number;
}

export interface EstimateComputed {
  totalHours: number;
  devCost: number;
  infraMonthlyBrl: number;
  infraCost: number;
  supportReserve: number;
  totalCost: number;
  priceMin: number;
  priceRecommended: number;
  pricePremium: number;
}

/** Puro e testável -- calcula o orçamento a partir das entradas do formulário. */
export function computeEstimate(input: EstimateCalcInput): EstimateComputed {
  const totalHours = input.hoursBreakdown.reduce((acc, h) => acc + h.hours, 0);
  const devCost = totalHours * input.hourlyRate;

  const infraMonthlyBrl = input.costItems.reduce(
    (acc, item) => acc + monthlyAmountBrl(item.amount, item.currency, item.billingCycle, input.usdToBrlRate),
    0,
  );
  const infraCost = (infraMonthlyBrl + input.agencyShareMonthly) * input.infraMonths;

  const supportReserve = devCost * (input.supportReservePct / 100);
  const totalCost = devCost + infraCost + supportReserve;

  const priceMin = totalCost;
  const priceRecommended = totalCost * (1 + input.marginPct / 100);
  const pricePremium = totalCost * (1 + input.marginPct / 100 + 0.15);

  return {
    totalHours,
    devCost,
    infraMonthlyBrl,
    infraCost,
    supportReserve,
    totalCost,
    priceMin,
    priceRecommended,
    pricePremium,
  };
}
