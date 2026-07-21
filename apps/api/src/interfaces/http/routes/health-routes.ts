import { prisma } from "@millead/database";
import { Router } from "express";
import { asyncHandler } from "../async-handler.js";

export function createHealthRoutes(): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  /** Checa dependências de verdade -- usado por orquestrador/monitoramento, não por humanos. */
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
