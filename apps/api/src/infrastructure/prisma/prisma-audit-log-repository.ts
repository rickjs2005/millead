import { prisma, Prisma } from "@millead/database";
import type { NewAuditLogEntry } from "../../domain/entities/audit-log.js";
import type { AuditLogRepository } from "../../domain/repositories/audit-log-repository.js";

export class PrismaAuditLogRepository implements AuditLogRepository {
  async record(entry: NewAuditLogEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.organizationId,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ? (entry.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }
}
