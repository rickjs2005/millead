import { Redis } from "ioredis";
import { env } from "../../config/env.js";

/**
 * Conexão Redis de uso geral (cache, rate-limit no futuro etc.).
 * BullMQ usa a SUA PRÓPRIA conexão (ver infrastructure/queue/connection.ts)
 * porque precisa de `maxRetriesPerRequest: null`, incompatível com o modo
 * "comando único" que o resto da app usa.
 */
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: false,
});

redis.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});
