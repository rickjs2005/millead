import type { Request, Response } from "express";
import type { ProjectChecklistService } from "../../../application/services/project-checklist-service.js";
import { ValidationError } from "../../../domain/errors/app-error.js";
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
    // Segmento de URL cru -- "/phases/abc" vira NaN, "/phases/3.7" não é
    // inteiro. Sem essa checagem, os dois chegam no Prisma e disparam um
    // PrismaClientValidationError sem mapeamento (500 genérico) em vez de
    // um 422 claro.
    if (!Number.isInteger(phaseNumber) || phaseNumber < 1) {
      throw new ValidationError("phaseNumber precisa ser um número inteiro positivo.");
    }
    const phase = await this.projectChecklists.updatePhaseStatus(
      auth.organizationId,
      req.params.id!,
      phaseNumber,
      req.body,
    );
    res.status(200).json(phase);
  };
}
