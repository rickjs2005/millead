import type { Request, Response } from "express";
import type { TeamService } from "../../../application/services/team-service.js";
import { getRequestMeta } from "../request-meta.js";
import { requireAuth } from "../require-auth.js";

export class TeamController {
  constructor(private readonly team: TeamService) {}

  directory = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.team.directory(auth.organizationId));
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.team.listMembers(auth.organizationId));
  };

  listInvitations = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.team.listInvitations(auth.organizationId));
  };

  listRoles = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.team.listRoles(auth.organizationId));
  };

  invite = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.team.invite(
      auth.organizationId,
      { userId: auth.userId, permissions: auth.permissions },
      req.body,
    );
    res.status(201).json(result);
  };

  revokeInvitation = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.team.revokeInvitation(auth.organizationId, req.params.id!);
    res.status(204).send();
  };

  updateMember = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const member = await this.team.updateMember(
      auth.organizationId,
      { userId: auth.userId, permissions: auth.permissions },
      req.params.id!,
      req.body,
    );
    res.status(200).json(member);
  };

  createRole = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const role = await this.team.createRole(
      auth.organizationId,
      { userId: auth.userId, permissions: auth.permissions },
      req.body,
    );
    res.status(201).json(role);
  };

  updateRole = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const role = await this.team.updateRole(
      auth.organizationId,
      { userId: auth.userId, permissions: auth.permissions },
      req.params.id!,
      req.body,
    );
    res.status(200).json(role);
  };

  deleteRole = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.team.deleteRole(
      auth.organizationId,
      { userId: auth.userId, permissions: auth.permissions },
      req.params.id!,
    );
    res.status(204).send();
  };

  previewInvitation = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.team.previewInvitation(req.body.token));
  };

  acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    const session = await this.team.acceptInvitation(req.body, getRequestMeta(req));
    res.status(200).json(session);
  };
}
