import type {
  CostSubscription,
  CostServiceCatalog,
  FinanceSettings,
} from "@millead/database";

export type { CostSubscription, CostServiceCatalog, FinanceSettings };

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
}
