import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository.js";

export interface AuditContext {
  organizationId: string | null;
  userId: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Fachada fina sobre AuditLogRepository -- use-cases chamam
 * `auditLogger.log(ctx, "auth.login", {...})` em vez de montar o objeto
 * NewAuditLogEntry inteiro toda vez.
 */
export class AuditLogger {
  constructor(private readonly repository: AuditLogRepository) {}

  async log(
    context: AuditContext,
    action: string,
    details?: { entityType?: string; entityId?: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await this.repository.record({
      organizationId: context.organizationId,
      userId: context.userId,
      action,
      entityType: details?.entityType ?? null,
      entityId: details?.entityId ?? null,
      metadata: details?.metadata ?? null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });
  }
}
