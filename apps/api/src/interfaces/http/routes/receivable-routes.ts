import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createPlanSchema,
  paySchema,
  receivableQuerySchema,
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
  router.get("/", read, validateQuery(receivableQuerySchema), asyncHandler(controller.list));
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
