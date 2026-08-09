import type {
  CreateCostSubscriptionInput,
  CreateUsageEntryInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../../application/dto/cost.dto.js";
import type {
  CostSubscription,
  CostServiceCatalog,
  CostUsageEntry,
  FinanceSettings,
} from "../entities/cost.js";

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
  hasUsageForSubscription(organizationId: string, subscriptionId: string): Promise<boolean>;
  listCatalog(organizationId: string): Promise<CostServiceCatalog[]>;
  getSettings(organizationId: string): Promise<FinanceSettings>;
  updateSettings(
    organizationId: string,
    // `usdRateUpdatedAt` não vem do DTO/usuário -- é setado internamente pelo
    // CostService tanto no PATCH manual quanto no refresh lazy automático.
    data: UpdateFinanceSettingsInput & { usdRateUpdatedAt?: Date },
  ): Promise<FinanceSettings>;
  countWonLeads(organizationId: string): Promise<number>;
  listUsage(organizationId: string, range: { from: Date; to: Date }): Promise<CostUsageEntry[]>;
  createUsage(
    organizationId: string,
    data: CreateUsageEntryInput & { unitPriceBrl: number | null },
  ): Promise<CostUsageEntry>;
  deleteUsage(organizationId: string, id: string): Promise<boolean>;
}
