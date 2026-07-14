/** Porta da fila de processamento de contratos (impl BullMQ em infrastructure/queue). */
export interface ContractQueue {
  enqueue(job: { contractId: string; organizationId: string }): Promise<void>;
}
