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
  // `isOneTime` ausente equivale a false (item recorrente/mensal).
  costItems: { amount: number; currency: Currency; billingCycle: Cycle; isOneTime?: boolean }[];
  agencyShareMonthly: number;
  infraMonths: number;
  supportReservePct: number;
  marginPct: number;
  usdToBrlRate: number;
  /** Anos de registro de domínio contratados -- null quando o orçamento não tem domínio. */
  domainYears: number | null;
  /** Preço BRL por ano de domínio -- 0 quando `domainYears` é null. */
  domainYearPriceBrl: number;
}

export interface EstimateComputed {
  totalHours: number;
  devCost: number;
  infraMonthlyBrl: number;
  /** Soma 1x dos itens `isOneTime` (ex.: créditos estimados de projeto). */
  oneTimeCost: number;
  infraCost: number;
  supportReserve: number;
  /** (domainYears ?? 0) × domainYearPriceBrl -- campo próprio, NÃO entra em infraCost/oneTimeCost. */
  domainCost: number;
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

  const infraMonthlyBrl = input.costItems
    .filter((item) => !item.isOneTime)
    .reduce(
      (acc, item) => acc + monthlyAmountBrl(item.amount, item.currency, item.billingCycle, input.usdToBrlRate),
      0,
    );
  // One-time IGNORA billingCycle -- só converte moeda, nunca divide por 12
  // (um item YEARLY aqui não é "por ano", é um valor único; `monthlyAmountBrl`
  // dividiria silenciosamente e mascararia o custo real).
  const oneTimeCost = input.costItems
    .filter((item) => item.isOneTime)
    .reduce((acc, item) => acc + (item.currency === "USD" ? item.amount * input.usdToBrlRate : item.amount), 0);
  // One-time soma 1x, fora do × infraMonths (créditos de projeto não são recorrentes).
  const infraCost = (infraMonthlyBrl + input.agencyShareMonthly) * input.infraMonths + oneTimeCost;

  const supportReserve = devCost * (input.supportReservePct / 100);
  // Domínio é campo próprio -- fora de infraCost/oneTimeCost (não é um
  // costItem, e não faz sentido multiplicar por infraMonths).
  const domainCost = (input.domainYears ?? 0) * input.domainYearPriceBrl;
  const totalCost = devCost + infraCost + supportReserve + domainCost;

  const priceMin = totalCost;
  const priceRecommended = totalCost * (1 + input.marginPct / 100);
  const pricePremium = totalCost * (1 + input.marginPct / 100 + 0.15);

  return {
    totalHours,
    devCost,
    infraMonthlyBrl,
    oneTimeCost,
    infraCost,
    supportReserve,
    domainCost,
    totalCost,
    priceMin,
    priceRecommended,
    pricePremium,
  };
}
