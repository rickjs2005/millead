export interface PostSaleJobData {
  executionId: string;
  contractId: string;
  organizationId: string;
}

/** Porta da fila da automação pós-fechamento (impl pg-boss em infrastructure/queue). */
export interface PostSaleQueue {
  enqueue(job: PostSaleJobData): Promise<void>;
}
