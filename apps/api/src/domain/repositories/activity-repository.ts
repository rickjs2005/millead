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
}
