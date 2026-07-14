import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import { draftMessageSchema } from "../../../application/dto/ai.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { AiController } from "../controllers/ai-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

export function createAiRoutes(controller: AiController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  // Qualquer usuário autenticado pode saber se a IA está habilitada.
  router.get("/status", asyncHandler(controller.status));

  router.post(
    "/leads/:leadId/score",
    requirePermission(PERMISSIONS.LEADS_WRITE),
    asyncHandler(controller.scoreLead),
  );
  router.post(
    "/leads/:leadId/report",
    requirePermission(PERMISSIONS.LEADS_READ),
    asyncHandler(controller.reportLead),
  );
  router.post(
    "/leads/:leadId/message",
    requirePermission(PERMISSIONS.MESSAGES_WRITE),
    validateBody(draftMessageSchema),
    asyncHandler(controller.draftMessage),
  );

  return router;
}
