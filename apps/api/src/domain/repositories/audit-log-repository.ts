import type { NewAuditLogEntry } from "../entities/audit-log.js";

export interface AuditLogRepository {
  record(entry: NewAuditLogEntry): Promise<void>;
}
