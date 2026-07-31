import type {
  CreateCostSubscriptionInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../../application/dto/cost.dto.js";
import type { CostSubscription, CostServiceCatalog, FinanceSettings } from "../entities/cost.js";

export interface CostRepository {
  listSubscriptions(organizationId: string): Promise<CostSubscription[]>;
  findSubscriptionById(organizationId: string, id: string): Promise<CostSubscription | null>;
  createSubscription(
    organizationId: string,
    data: CreateCostSubscriptionInput,
  ): Promise<CostSubscription>;
  updateSubscription(
    organizationId: string,
    id: string,
    data: UpdateCostSubscriptionInput,
  ): Promise<CostSubscription | null>;
  deleteSubscription(organizationId: string, id: string): Promise<boolean>;
  listCatalog(organizationId: string): Promise<CostServiceCatalog[]>;
  getSettings(organizationId: string): Promise<FinanceSettings>;
  updateSettings(
    organizationId: string,
    data: UpdateFinanceSettingsInput,
  ): Promise<FinanceSettings>;
  countWonLeads(organizationId: string): Promise<number>;
}
