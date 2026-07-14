import { Redis } from "ioredis";
import { env } from "../../config/env.js";

/** BullMQ exige `maxRetriesPerRequest: null` -- conexão dedicada, separada da genérica. */
export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
