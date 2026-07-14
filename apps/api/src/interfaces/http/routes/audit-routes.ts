import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import { createAuditSchema, listAuditsQuerySchema } from "../../../application/dto/audit.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { AuditController } from "../controllers/audit-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createAuditRoutes(
  controller: AuditController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.AUDITS_READ);
  const write = requirePermission(PERMISSIONS.AUDITS_WRITE);

  router.post("/", write, validateBody(createAuditSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listAuditsQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));

  return router;
}
