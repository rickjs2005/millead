import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  addLeadContactSchema,
  addLeadNoteSchema,
  addLeadTagSchema,
  createLeadSchema,
  listActivitiesQuerySchema,
  listLeadsQuerySchema,
  moveLeadStageSchema,
  updateLeadSchema,
} from "../../../application/dto/lead.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { LeadController } from "../controllers/lead-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createLeadRoutes(controller: LeadController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.LEADS_READ);
  const write = requirePermission(PERMISSIONS.LEADS_WRITE);

  router.post("/", write, validateBody(createLeadSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listLeadsQuerySchema), asyncHandler(controller.list));
  // Antes de /:id -- senão "finance"/"activities" seriam capturados como id.
  router.get("/finance", read, asyncHandler(controller.finance));
  router.get("/activities/recent", read, asyncHandler(controller.recentActivities));
  router.get("/:id", read, asyncHandler(controller.get));
  router.patch("/:id", write, validateBody(updateLeadSchema), asyncHandler(controller.update));
  router.delete("/:id", write, asyncHandler(controller.delete));
  router.patch(
    "/:id/stage",
    write,
    validateBody(moveLeadStageSchema),
    asyncHandler(controller.moveStage),
  );

  router.post(
    "/:id/contacts",
    write,
    validateBody(addLeadContactSchema),
    asyncHandler(controller.addContact),
  );
  router.delete("/:id/contacts/:contactId", write, asyncHandler(controller.removeContact));

  router.post(
    "/:id/notes",
    write,
    validateBody(addLeadNoteSchema),
    asyncHandler(controller.addNote),
  );

  router.post("/:id/tags", write, validateBody(addLeadTagSchema), asyncHandler(controller.addTag));
  router.delete("/:id/tags/:tagId", write, asyncHandler(controller.removeTag));

  router.get(
    "/:id/activities",
    read,
    validateQuery(listActivitiesQuerySchema),
    asyncHandler(controller.listActivities),
  );

  return router;
}
