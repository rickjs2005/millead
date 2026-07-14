import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  addMeetingAttendeeSchema,
  createMeetingSchema,
  listMeetingsQuerySchema,
  updateMeetingSchema,
} from "../../../application/dto/meeting.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { MeetingController } from "../controllers/meeting-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createMeetingRoutes(
  controller: MeetingController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.MEETINGS_READ);
  const write = requirePermission(PERMISSIONS.MEETINGS_WRITE);

  router.post("/", write, validateBody(createMeetingSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listMeetingsQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.patch("/:id", write, validateBody(updateMeetingSchema), asyncHandler(controller.update));

  router.post(
    "/:id/attendees",
    write,
    validateBody(addMeetingAttendeeSchema),
    asyncHandler(controller.addAttendee),
  );
  router.delete("/:id/attendees/:attendeeId", write, asyncHandler(controller.removeAttendee));

  return router;
}
