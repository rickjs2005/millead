/**
 * Porta da fila de auditoria -- a aplicação enfileira sem saber que existe
 * BullMQ (implementação em infrastructure/queue/bull-audit-queue.ts).
 */
export interface AuditQueue {
  enqueue(job: { auditId: string; organizationId: string; url: string }): Promise<void>;
}
