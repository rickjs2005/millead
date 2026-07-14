import type { ContractQueue } from "../../domain/services/contract-queue.js";
import { contractQueue, type ContractJobData } from "./queues.js";

export class BullContractQueue implements ContractQueue {
  async enqueue(job: ContractJobData): Promise<void> {
    await contractQueue.add("process", job, {
      // BullMQ proíbe ":" em jobId custom -- separador "-".
      jobId: `${job.contractId}-${Date.now()}`,
    });
  }
}
