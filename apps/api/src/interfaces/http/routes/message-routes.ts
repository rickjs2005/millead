import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createMessageTemplateSchema,
  listMessagesQuerySchema,
  updateMessageSchema,
  updateMessageTemplateSchema,
} from "../../../application/dto/message.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { MessageController } from "../controllers/message-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createMessageRoutes(
  controller: MessageController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.MESSAGES_READ);
  const write = requirePermission(PERMISSIONS.MESSAGES_WRITE);

  // Templates primeiro: rota literal antes da paramétrica /:id.
  router.get("/templates", read, asyncHandler(controller.listTemplates));
  router.post(
    "/templates",
    write,
    validateBody(createMessageTemplateSchema),
    asyncHandler(controller.createTemplate),
  );
  router.patch(
    "/templates/:id",
    write,
    validateBody(updateMessageTemplateSchema),
    asyncHandler(controller.updateTemplate),
  );

  router.get("/", read, validateQuery(listMessagesQuerySchema), asyncHandler(controller.list));
  router.patch("/:id", write, validateBody(updateMessageSchema), asyncHandler(controller.update));

  return router;
}
