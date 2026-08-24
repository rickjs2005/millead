import type { Request, Response } from "express";
import type { ProjectChecklistService } from "../../../application/services/project-checklist-service.js";
import { requireAuth } from "../require-auth.js";

export class ProjectChecklistController {
  constructor(private readonly projectChecklists: ProjectChecklistService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const checklist = await this.projectChecklists.create(auth.organizationId, req.body);
    res.status(201).json(checklist);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const checklists = await this.projectChecklists.list(auth.organizationId);
    res.status(200).json(checklists);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const checklist = await this.projectChecklists.get(auth.organizationId, req.params.id!);
    res.status(200).json(checklist);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.projectChecklists.delete(auth.organizationId, req.params.id!);
    res.status(204).send();
  };

  updatePhaseStatus = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const phaseNumber = Number(req.params.phaseNumber);
    const phase = await this.projectChecklists.updatePhaseStatus(
      auth.organizationId,
      req.params.id!,
      phaseNumber,
      req.body,
    );
    res.status(200).json(phase);
  };
}
