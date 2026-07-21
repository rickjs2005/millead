import type { AuditQueue } from "../../domain/services/audit-queue.js";
import { getBoss } from "./boss.js";
import { QUEUE_NAMES, type AuditJobData } from "./queues.js";

/** Implementação pg-boss da porta AuditQueue -- só o composition root conhece. */
export class PgBossAuditQueue implements AuditQueue {
  async enqueue(job: AuditJobData): Promise<void> {
    const boss = await getBoss();
    await boss.send(QUEUE_NAMES.AUDIT_SITE, job, {
      // Mesma semântica do jobId=auditId do BullMQ: enfileirar a mesma
      // auditoria duas vezes não duplica enquanto a primeira não terminar.
      singletonKey: job.auditId,
      retryLimit: 1, // 2 tentativas no total (a 2ª cobre soluço de rede)
      retryDelay: 5,
      retryBackoff: true,
    });
  }
}
