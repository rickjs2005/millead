/**
 * Espelho client de `apps/api/src/application/services/estimate-calc.ts` --
 * mesma assinatura, pura em TS, usada só para o preview ao vivo do formulário
 * (a resposta persistida da API sempre traz `computed` já calculado no
 * servidor, que é a fonte da verdade). Mudou lá, muda aqui.
 */

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

/** Espelho de `monthlyAmountBrl` em apps/api/src/application/services/cost-service.ts. */
export function monthlyAmountBrl(
  amount: number,
  currency: Currency,
  billingCycle: Cycle,
  usdToBrlRate: number,
): number {
  const brl = currency === "USD" ? amount * usdToBrlRate : amount;
  return billingCycle === "YEARLY" ? brl / 12 : brl;
}

/** Espelho de `computeEstimate` em apps/api/src/application/services/estimate-calc.ts. */
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
