import type { BriefingQueue } from "../../domain/services/briefing-queue.js";
import { briefingQueue, type BriefingJobData } from "./queues.js";

export class BullBriefingQueue implements BriefingQueue {
  async enqueue(job: BriefingJobData): Promise<void> {
    await briefingQueue.add("process", job, {
      // BullMQ proíbe ":" em jobId custom -- separador "-".
      jobId: `${job.briefingId}-${Date.now()}`,
    });
  }
}
