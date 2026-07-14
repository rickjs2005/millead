import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import { createTagSchema } from "../../../application/dto/tag.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { TagController } from "../controllers/tag-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

// Tags não têm chave de permissão própria no catálogo -- são um recurso
// satélite dos leads (etiquetas pra organizar/filtrar), então reaproveitam
// leads:read / leads:write em vez de crescer o catálogo por um recurso tão
// pequeno.
export function createTagRoutes(controller: TagController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission(PERMISSIONS.LEADS_READ), asyncHandler(controller.list));
  router.post(
    "/",
    requirePermission(PERMISSIONS.LEADS_WRITE),
    validateBody(createTagSchema),
    asyncHandler(controller.create),
  );

  return router;
}
