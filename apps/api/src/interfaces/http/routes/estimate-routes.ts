import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  convertEstimateSchema,
  createEstimateSchema,
  listEstimatesQuerySchema,
  updateEstimateSchema,
} from "../../../application/dto/estimate.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { EstimateController } from "../controllers/estimate-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

// Calculadora de Orçamentos reusa proposals:* (mesma decisão do Centro de
// Custos -- quem gerencia propostas gerencia orçamentos, evita crescer o
// catálogo de permissões).
export function createEstimateRoutes(
  controller: EstimateController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  // Antes de /:id -- senão "products" seria capturado como id.
  router.get("/products", read, asyncHandler(controller.products));

  router.get("/", read, validateQuery(listEstimatesQuerySchema), asyncHandler(controller.list));
  router.post("/", write, validateBody(createEstimateSchema), asyncHandler(controller.create));
  router.get("/:id", read, asyncHandler(controller.get));
  router.patch(
    "/:id",
    write,
    validateBody(updateEstimateSchema),
    asyncHandler(controller.update),
  );
  router.delete("/:id", write, asyncHandler(controller.remove));
  router.post(
    "/:id/convert",
    write,
    validateBody(convertEstimateSchema),
    asyncHandler(controller.convert),
  );

  return router;
}
