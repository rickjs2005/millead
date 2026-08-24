import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createProjectChecklistSchema,
  updatePhaseStatusSchema,
} from "../../../application/dto/project-checklist.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { ProjectChecklistController } from "../controllers/project-checklist-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

export function createProjectChecklistRoutes(
  controller: ProjectChecklistController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROJECT_CHECKLISTS_READ);
  const write = requirePermission(PERMISSIONS.PROJECT_CHECKLISTS_WRITE);

  router.post(
    "/",
    write,
    validateBody(createProjectChecklistSchema),
    asyncHandler(controller.create),
  );
  router.get("/", read, asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.delete("/:id", write, asyncHandler(controller.delete));
  router.patch(
    "/:id/phases/:phaseNumber",
    write,
    validateBody(updatePhaseStatusSchema),
    asyncHandler(controller.updatePhaseStatus),
  );

  return router;
}
