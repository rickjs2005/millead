/** Porta da fila de geração de landing pages (impl BullMQ em infrastructure/queue). */
export interface LandingPageQueue {
  enqueue(job: { landingPageId: string; organizationId: string }): Promise<void>;
}
