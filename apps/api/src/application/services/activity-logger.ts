import type { ActivityType } from "@millead/database";
import type { ActivityRepository } from "../../domain/repositories/activity-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";

/**
 * Fachada fina sobre ActivityRepository -- paralela à AuditLogger, mas pra
 * a timeline de NEGÓCIO de um lead (o que aconteceu com ele), não pra
 * trilha de segurança/sistema.
 */
export class ActivityLogger {
  constructor(private readonly repository: ActivityRepository) {}

  async log(
    organizationId: string,
    leadId: string | null,
    userId: string | null,
    type: ActivityType,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.repository.record({ organizationId, leadId, userId, type, payload });
  }

  async listForLead(organizationId: string, leadId: string, pagination: PaginationParams) {
    return this.repository.listForLead(leadId, organizationId, pagination);
  }

  /** Últimas atividades da org inteira -- alimenta o sino de notificações. */
  async listRecent(organizationId: string, limit = 15) {
    return this.repository.listRecentForOrg(organizationId, limit);
  }
}
