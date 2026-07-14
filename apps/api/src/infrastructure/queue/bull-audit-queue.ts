import type { AuditQueue } from "../../domain/services/audit-queue.js";
import { auditQueue, type AuditJobData } from "./queues.js";

/** Implementação BullMQ da porta AuditQueue -- só o composition root conhece. */
export class BullAuditQueue implements AuditQueue {
  async enqueue(job: AuditJobData): Promise<void> {
    await auditQueue.add("audit-site", job, {
      // jobId = auditId: enfileirar a mesma auditoria duas vezes não duplica o job.
      jobId: job.auditId,
    });
  }
}
