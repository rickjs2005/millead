import type { CostBillingCycle, CostCategory, CostScope } from "@/types/api";

export const SCOPE_LABELS: Record<CostScope, string> = {
  AGENCY: "Agência",
  CLIENT: "Por cliente",
};

export const CYCLE_LABELS: Record<CostBillingCycle, string> = {
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  HOSTING: "Hospedagem",
  DATABASE: "Banco de dados",
  AI: "IA",
  DOMAIN: "Domínio",
  EMAIL: "E-mail",
  SIGNATURE: "Assinatura digital",
  OTHER: "Outros",
};
