import { prisma } from "@millead/database";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { stopBoss } from "../infrastructure/queue/boss.js";
import { buildContainer } from "./container.js";
import { createApp } from "./app.js";

const container = buildContainer();
const app = createApp(container);

const server = app.listen(env.API_PORT, () => {
  logger.info(`MilLead API no ar em http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

// Deploy econômico (ex.: free tier do Render, um serviço só): com
// START_WORKERS=true os workers BullMQ sobem NO MESMO processo da API.
// Em dev/produção com mais tráfego, prefira o processo separado
// (`pnpm dev:worker` / `start:worker`) e deixe esta env desligada.
if (env.START_WORKERS) {
  void import("../interfaces/jobs/index.js").then(() => {
    logger.info("workers BullMQ rodando no processo da API (START_WORKERS=true)");
  });
}

async function shutdown(signal: string) {
  logger.info(`${signal} recebido, encerrando com calma...`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), stopBoss()]);
    logger.info("desligado.");
    process.exit(0);
  });
  // Se algo travar, força a saída em vez de pendurar o processo pra sempre.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
