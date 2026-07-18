/** Porta da fila de processamento de briefings (impl BullMQ em infrastructure/queue). */
export interface BriefingQueue {
  enqueue(job: { briefingId: string; organizationId: string }): Promise<void>;
}
