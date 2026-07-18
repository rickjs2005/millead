import type { Activity, NewActivity } from "../entities/activity.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface ActivityRepository {
  record(entry: NewActivity): Promise<void>;
  /** Timeline de um lead, mais recente primeiro. */
  listForLead(
    leadId: string,
    organizationId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Activity>>;
  /** Últimas atividades da organização inteira -- alimenta o sino de notificações. */
  listRecentForOrg(organizationId: string, limit: number): Promise<Activity[]>;
}
