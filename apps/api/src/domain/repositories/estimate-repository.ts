import type { EstimateStatus } from "@millead/database";
import type { CreateEstimateInput, UpdateEstimateInput } from "../../application/dto/estimate.dto.js";
import type { PricingEstimateWithItems, ProjectProduct } from "../entities/estimate.js";

export interface EstimateRepository {
  list(
    organizationId: string,
    params: { status?: EstimateStatus; page: number; pageSize: number },
  ): Promise<{ items: PricingEstimateWithItems[]; total: number }>;
  findById(organizationId: string, id: string): Promise<PricingEstimateWithItems | null>;
  create(
    organizationId: string,
    createdById: string,
    data: CreateEstimateInput,
  ): Promise<PricingEstimateWithItems>;
  update(
    organizationId: string,
    id: string,
    data: UpdateEstimateInput,
  ): Promise<PricingEstimateWithItems | null>;
  delete(organizationId: string, id: string): Promise<boolean>;
  listProducts(organizationId: string): Promise<ProjectProduct[]>;
  /** Marca o orçamento como convertido e vincula a proposta gerada -- passo final do `convert`. */
  markConverted(organizationId: string, id: string, proposalId: string): Promise<void>;
  /**
   * Relação inversa de `markConverted` -- `proposalId` é @unique no schema,
   * então no máximo um orçamento aponta pra uma proposta dada. Usado pelo
   * aceite público pra herdar scopeItems/deadlineDays no contrato rascunho.
   */
  findByProposalId(proposalId: string): Promise<PricingEstimateWithItems | null>;
}
