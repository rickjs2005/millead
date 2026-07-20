import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import {
  confirmFileSchema,
  createBriefingSchema,
  createCustomBriefingSchema,
  listBriefingsQuerySchema,
  removeGroupItemSchema,
  saveAnswerSchema,
  uploadTokenSchema,
} from "../../../application/dto/briefing.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { BriefingController } from "../controllers/briefing-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

/**
 * Rotas autenticadas. Reusa as permissões de Leads de propósito (briefing é
 * um anexo/atividade do lead; permissão própria exigiria re-seed do RBAC).
 */
export function createBriefingRoutes(
  controller: BriefingController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.LEADS_READ);
  const write = requirePermission(PERMISSIONS.LEADS_WRITE);

  router.get("/templates", read, asyncHandler(controller.listTemplates));
  router.get("/templates/:key", read, asyncHandler(controller.getTemplate));

  router.post("/", write, validateBody(createBriefingSchema), asyncHandler(controller.create));
  router.post(
    "/custom",
    write,
    validateBody(createCustomBriefingSchema),
    asyncHandler(controller.createCustom),
  );
  router.get("/", read, validateQuery(listBriefingsQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.post("/:id/archive", write, asyncHandler(controller.archive));
  router.post("/:id/duplicate", write, asyncHandler(controller.duplicate));
  router.post("/:id/resend-email", write, asyncHandler(controller.resendEmail));
  router.post("/:id/resend-whatsapp", write, asyncHandler(controller.resendWhatsapp));

  return router;
}

/**
 * Formulário público (wizard) -- SEM auth, tudo resolvido via :token.
 * Rate-limit mais permissivo na resposta (autosave dispara a cada poucos
 * segundos ao longo de várias etapas) do que na conclusão/leitura inicial.
 */
export function createPublicBriefingRoutes(controller: BriefingController): Router {
  const router = Router();

  const readLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um minuto." } },
  });
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 90,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um minuto." } },
  });

  router.get("/briefings/:token", readLimiter, asyncHandler(controller.getPublic));
  router.patch(
    "/briefings/:token/answers",
    writeLimiter,
    validateBody(saveAnswerSchema),
    asyncHandler(controller.saveAnswerPublic),
  );
  router.delete(
    "/briefings/:token/answers/group-item",
    writeLimiter,
    validateBody(removeGroupItemSchema),
    asyncHandler(controller.removeGroupItemPublic),
  );
  router.post(
    "/briefings/:token/upload-token",
    writeLimiter,
    validateBody(uploadTokenSchema),
    asyncHandler(controller.uploadTokenPublic),
  );
  router.post(
    "/briefings/:token/files",
    writeLimiter,
    validateBody(confirmFileSchema),
    asyncHandler(controller.confirmFilePublic),
  );
  router.post("/briefings/:token/complete", readLimiter, asyncHandler(controller.completePublic));

  return router;
}
