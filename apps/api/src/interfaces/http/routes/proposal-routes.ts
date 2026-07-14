import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createProposalSchema,
  listProposalsQuerySchema,
  updateProposalSchema,
} from "../../../application/dto/proposal.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { ProposalController } from "../controllers/proposal-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createProposalRoutes(
  controller: ProposalController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  router.post("/", write, validateBody(createProposalSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listProposalsQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.patch("/:id", write, validateBody(updateProposalSchema), asyncHandler(controller.update));

  return router;
}
