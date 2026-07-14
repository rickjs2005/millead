import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "../../../application/dto/task.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { TaskController } from "../controllers/task-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createTaskRoutes(controller: TaskController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.TASKS_READ);
  const write = requirePermission(PERMISSIONS.TASKS_WRITE);

  router.post("/", write, validateBody(createTaskSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listTasksQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.patch("/:id", write, validateBody(updateTaskSchema), asyncHandler(controller.update));
  router.delete("/:id", write, asyncHandler(controller.delete));

  return router;
}
