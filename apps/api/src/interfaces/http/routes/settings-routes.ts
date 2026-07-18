import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  updateOrganizationSchema,
  updateProfileSchema,
} from "../../../application/dto/settings.dto.js";
import type { SettingsController } from "../controllers/settings-controller.js";
import { asyncHandler } from "../async-handler.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

export function createSettingsRoutes(
  controller: SettingsController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  // O próprio nome, qualquer usuário logado pode trocar.
  router.patch("/profile", validateBody(updateProfileSchema), asyncHandler(controller.updateProfile));
  // Nome da organização afeta todo mundo -- exige permissão de settings.
  router.patch(
    "/organization",
    requirePermission(PERMISSIONS.SETTINGS_MANAGE),
    validateBody(updateOrganizationSchema),
    asyncHandler(controller.updateOrganization),
  );

  return router;
}
