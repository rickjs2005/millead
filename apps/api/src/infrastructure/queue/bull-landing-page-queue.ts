import type { LandingPageQueue } from "../../domain/services/landing-page-queue.js";
import { landingPageQueue, type LandingPageJobData } from "./queues.js";

export class BullLandingPageQueue implements LandingPageQueue {
  async enqueue(job: LandingPageJobData): Promise<void> {
    await landingPageQueue.add("generate", job, {
      // Sufixo de tempo: um reenfileiramento não colide com o job anterior
      // (BullMQ guarda jobs concluídos/falhos por um tempo com o mesmo id).
      // Atenção: BullMQ proíbe ":" em jobId custom -- separador "-".
      jobId: `${job.landingPageId}-${Date.now()}`,
    });
  }
}
