import type { ProposalPdfData } from "../../infrastructure/proposals/pdf/render.js";

/** Só o que o PDF do cliente precisa do orçamento -- nada de custo interno. */
interface EstimateParaPdf {
  title: string;
  scopeItems: string[];
  deadlineDays: number;
  paymentTerms: string;
  validDays: number;
  infraMonths: number;
  domainYears: number | null;
  finalPrice: number | null;
}

export interface MontarPdfInput {
  estimate: EstimateParaPdf;
  computed: { infraMonthlyBrl: number; domainCost: number; priceRecommended: number };
  orgName: string;
  clientName: string;
  productName: string | null;
  proposalNumber: string;
  createdAt: Date;
  /** Preço explícito da conversão -- vence a cascata quando informado. */
  priceOverride?: number | null;
  /** true = prévia baixada do orçamento (rótulo no topo, sem proposta criada). */
  preview?: boolean;
}

/** Preço explícito da conversão > final decidido pelo dono > recomendado. */
export function resolverPreco(input: {
  priceOverride?: number | null;
  finalPrice: number | null;
  priceRecommended: number;
}): number {
  // `??` e não `||`: preço zero é decisão do dono, não ausência de preço.
  return input.priceOverride ?? input.finalPrice ?? input.priceRecommended;
}

/**
 * Monta o documento do cliente a partir do orçamento. Existe pra que a PRÉVIA
 * e a PROPOSTA final saiam do mesmo lugar: se as duas divergirem, a prévia
 * passa a mentir sobre o que o cliente vai receber (e assinar).
 */
export function montarPdfDaProposta(input: MontarPdfInput): ProposalPdfData {
  const { estimate, computed } = input;
  const finalPrice = resolverPreco({
    priceOverride: input.priceOverride,
    finalPrice: estimate.finalPrice,
    priceRecommended: computed.priceRecommended,
  });

  return {
    proposalNumber: input.proposalNumber,
    orgName: input.orgName,
    clientName: input.clientName,
    projectTitle: estimate.title,
    productName: input.productName,
    scopeItems: estimate.scopeItems,
    deadlineDays: estimate.deadlineDays,
    paymentTerms: estimate.paymentTerms,
    validDays: estimate.validDays,
    finalPrice,
    infraMonthlyBrl: computed.infraMonthlyBrl,
    infraMonths: estimate.infraMonths,
    domainYears: estimate.domainYears,
    domainCostBrl: computed.domainCost,
    createdAt: input.createdAt,
    preview: input.preview ?? false,
  };
}
