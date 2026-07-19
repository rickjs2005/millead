import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createLandingPageSchema,
  listLandingPagesQuerySchema,
  publishLandingPageSchema,
  regenerateLandingPageSchema,
} from "../../../application/dto/landing-page.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { LandingPageController } from "../controllers/landing-page-controller.js";
import { aiRateLimit } from "../middlewares/rate-limit.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

/**
 * Rotas autenticadas de gestão. Reusa as permissões de leads de propósito:
 * landing page é artefato de venda de um lead/empresa -- criar permissão
 * própria exigiria re-seed do catálogo RBAC sem ganho real hoje.
 */
export function createLandingPageRoutes(
  controller: LandingPageController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.LEADS_READ);
  const write = requirePermission(PERMISSIONS.LEADS_WRITE);

  router.post("/", write, validateBody(createLandingPageSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listLandingPagesQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.post(
    "/:id/regenerate",
    aiRateLimit,
    write,
    validateBody(regenerateLandingPageSchema),
    asyncHandler(controller.regenerate),
  );
  router.post(
    "/:id/publish",
    write,
    validateBody(publishLandingPageSchema),
    asyncHandler(controller.publish),
  );
  router.delete("/:id", write, asyncHandler(controller.delete));

  return router;
}

/** Rota pública -- SEM authenticate: é o link que o prospect abre. */
export function createPublicLandingPageRoutes(controller: LandingPageController): Router {
  const router = Router();
  router.get("/:slug", asyncHandler(controller.servePublic));
  return router;
}
