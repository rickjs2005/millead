import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createPlanSchema,
  createStandaloneSchema,
  paySchema,
  receivableQuerySchema,
  receivableSeriesQuerySchema,
  updateReceivableSchema,
} from "../../../application/dto/receivable.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { ReceivableController } from "../controllers/receivable-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

// Contas a receber reusa proposals:* (mesma decisão que Centro de Custos).
export function createReceivableRoutes(
  controller: ReceivableController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  router.post("/plan", write, validateBody(createPlanSchema), asyncHandler(controller.createPlan));
  // "/standalone" (receita avulsa) registrada ANTES das rotas parametricas
  // "/:id" abaixo -- mesma convenção de "/summary/series" vs "/summary".
  router.post(
    "/standalone",
    write,
    validateBody(createStandaloneSchema),
    asyncHandler(controller.createStandalone),
  );
  router.get("/standalone", read, asyncHandler(controller.listStandalone));
  router.get("/", read, validateQuery(receivableQuerySchema), asyncHandler(controller.list));
  // Registrada ANTES de qualquer rota "/:id" -- Express casa rotas na ordem
  // de declaração, e "/summary/series" tem que resolver pro handler certo
  // mesmo que uma rota "/:id"-like venha a existir depois neste arquivo.
  router.get(
    "/summary/series",
    read,
    validateQuery(receivableSeriesQuerySchema),
    asyncHandler(controller.series),
  );
  router.get("/summary", read, validateQuery(receivableQuerySchema), asyncHandler(controller.summary));
  router.get("/margin", read, validateQuery(receivableQuerySchema), asyncHandler(controller.margin));

  router.patch(
    "/:id/pay",
    write,
    validateBody(paySchema),
    asyncHandler(controller.pay),
  );
  router.patch("/:id/unpay", write, asyncHandler(controller.unpay));
  router.patch(
    "/:id",
    write,
    validateBody(updateReceivableSchema),
    asyncHandler(controller.update),
  );
  router.delete("/:id", write, asyncHandler(controller.remove));

  return router;
}
