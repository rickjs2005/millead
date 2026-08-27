import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import { updatePostSaleSettingsSchema } from "../../../application/dto/post-sale-automation.dto.js";
import {
  updateOrganizationSchema,
  updateProfileSchema,
} from "../../../application/dto/settings.dto.js";
import type { PostSaleController } from "../controllers/post-sale-controller.js";
import type { SettingsController } from "../controllers/settings-controller.js";
import { asyncHandler } from "../async-handler.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

export function createSettingsRoutes(
  controller: SettingsController,
  postSale: PostSaleController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  // Status das integrações da plataforma -- só leitura, sem segredos, qualquer logado vê.
  router.get("/integrations", asyncHandler(controller.integrations));

  // O próprio nome, qualquer usuário logado pode trocar.
  router.patch(
    "/profile",
    validateBody(updateProfileSchema),
    asyncHandler(controller.updateProfile),
  );
  // Nome da organização afeta todo mundo -- exige permissão de settings.
  router.patch(
    "/organization",
    requirePermission(PERMISSIONS.SETTINGS_MANAGE),
    validateBody(updateOrganizationSchema),
    asyncHandler(controller.updateOrganization),
  );

  // Automação pós-fechamento. Ler TAMBÉM exige settings:manage (e não só
  // sessão): a configuração é operacional/financeira -- prazos e número de
  // parcelas padrão -- e a tela que a consome é a de administração.
  const manageSettings = requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  router.get("/post-sale-automation", manageSettings, asyncHandler(postSale.getSettings));
  router.patch(
    "/post-sale-automation",
    manageSettings,
    validateBody(updatePostSaleSettingsSchema),
    asyncHandler(postSale.updateSettings),
  );
  // Membros da organização, só pra escolher o responsável padrão. Devolve
  // nome/e-mail/papel -- nada de sessão, hash ou permissão individual.
  router.get("/members", manageSettings, asyncHandler(postSale.listMembers));

  return router;
}
