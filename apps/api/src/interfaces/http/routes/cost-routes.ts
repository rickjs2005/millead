import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createCostSubscriptionSchema,
  createUsageEntrySchema,
  updateCostSubscriptionSchema,
  updateFinanceSettingsSchema,
  usageQuerySchema,
} from "../../../application/dto/cost.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { CostController } from "../controllers/cost-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

// Centro de Custos reusa proposals:* (decisão da spec do módulo Financeiro):
// quem gerencia propostas gerencia custos -- evita crescer o catálogo de
// permissões e re-seed em produção (mesmo atalho de Contratos/Briefings).
export function createCostRoutes(controller: CostController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  router.get("/catalog", read, asyncHandler(controller.catalog));
  router.get("/settings", read, asyncHandler(controller.getSettings));
  router.patch(
    "/settings",
    write,
    validateBody(updateFinanceSettingsSchema),
    asyncHandler(controller.updateSettings),
  );
  router.get("/summary", read, asyncHandler(controller.summary));

  // Consumo de créditos (Fase 5) -- registradas antes de `/:id` de assinatura.
  router.get("/usage/summary", read, validateQuery(usageQuerySchema), asyncHandler(controller.usageSummary));
  router.get("/usage", read, validateQuery(usageQuerySchema), asyncHandler(controller.listUsage));
  router.post("/usage", write, validateBody(createUsageEntrySchema), asyncHandler(controller.createUsage));
  router.delete("/usage/:id", write, asyncHandler(controller.removeUsage));

  router.get("/", read, asyncHandler(controller.list));
  router.post("/", write, validateBody(createCostSubscriptionSchema), asyncHandler(controller.create));
  router.patch(
    "/:id",
    write,
    validateBody(updateCostSubscriptionSchema),
    asyncHandler(controller.update),
  );
  router.delete("/:id", write, asyncHandler(controller.remove));

  return router;
}
