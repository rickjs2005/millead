import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  acceptTeamInvitationSchema,
  createTeamRoleSchema,
  invitationTokenSchema,
  inviteTeamMemberSchema,
  updateTeamMemberSchema,
  updateTeamRoleSchema,
} from "../../../application/dto/team.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { TeamController } from "../controllers/team-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

export function createTeamRoutes(controller: TeamController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  const manageMembers = requirePermission(PERMISSIONS.MEMBERS_MANAGE);
  const manageRoles = requirePermission(PERMISSIONS.ROLES_MANAGE);

  // Diretório mínimo é necessário para atribuir responsáveis a leads/tarefas.
  router.get("/directory", asyncHandler(controller.directory));
  router.get("/roles", asyncHandler(controller.listRoles));
  router.get("/members", manageMembers, asyncHandler(controller.listMembers));
  router.patch(
    "/members/:id",
    manageMembers,
    validateBody(updateTeamMemberSchema),
    asyncHandler(controller.updateMember),
  );
  router.get("/invitations", manageMembers, asyncHandler(controller.listInvitations));
  router.post(
    "/invitations",
    manageMembers,
    validateBody(inviteTeamMemberSchema),
    asyncHandler(controller.invite),
  );
  router.delete("/invitations/:id", manageMembers, asyncHandler(controller.revokeInvitation));
  router.post(
    "/roles",
    manageRoles,
    validateBody(createTeamRoleSchema),
    asyncHandler(controller.createRole),
  );
  router.patch(
    "/roles/:id",
    manageRoles,
    validateBody(updateTeamRoleSchema),
    asyncHandler(controller.updateRole),
  );
  router.delete("/roles/:id", manageRoles, asyncHandler(controller.deleteRole));

  return router;
}

export function createPublicTeamRoutes(controller: TeamController): Router {
  const router = Router();
  // Token no corpo: evita que logs HTTP guardem o segredo no path/query.
  router.post(
    "/team-invitations/preview",
    validateBody(invitationTokenSchema),
    asyncHandler(controller.previewInvitation),
  );
  router.post(
    "/team-invitations/accept",
    validateBody(acceptTeamInvitationSchema),
    asyncHandler(controller.acceptInvitation),
  );
  return router;
}
