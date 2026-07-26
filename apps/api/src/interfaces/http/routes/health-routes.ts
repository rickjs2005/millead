import { prisma } from "@millead/database";
import { Router } from "express";
import { resolveCommit, startedAt } from "../../../shared/version.js";
import { asyncHandler } from "../async-handler.js";

export function createHealthRoutes(): Router {
  const router = Router();

  /**
   * Liveness + identidade do build. `commit` e `startedAt` respondem "qual
   * código está no ar?" -- web (Vercel) e API (Render) deployam separado, e
   * sem isso a diferença entre "ainda não subiu" e "está quebrado" vira
   * adivinhação. Rota pública: expõe só o SHA curto, nada de config.
   */
  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", commit: resolveCommit(process.env), startedAt });
  });

  /**
   * Liveness com dependência: faz `SELECT 1` no banco e devolve 200/`ready`
   * ou 503/`not-ready`. Usado por orquestrador/monitoramento, não por humanos.
   *
   * Checa SÓ o banco, de propósito: a API sobe e serve sem Redis (quem depende
   * de fila é o worker, em processo separado). Um 200 aqui não diz nada sobre a
   * saúde dos workers -- não use esta rota como prova de que a fila está viva.
   */
  router.get(
    "/health/ready",
    asyncHandler(async (_req, res) => {
      const checks = { database: false };

      try {
        await prisma.$queryRaw`SELECT 1`;
        checks.database = true;
      } catch {
        checks.database = false;
      }

      const ready = checks.database;
      res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", checks });
    }),
  );

  return router;
}
