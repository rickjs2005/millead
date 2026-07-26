import type { Request, Response } from "express";
import type { AiService } from "../../../application/services/ai-service.js";
import { requireAuth } from "../require-auth.js";

export class AiController {
  constructor(private readonly ai: AiService) {}

  status = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(this.ai.status());
  };

  scoreLead = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.ai.scoreLead(auth.organizationId, auth.userId, req.params.leadId!);
    res.status(200).json(result);
  };

  reportLead = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.ai.reportLead(auth.organizationId, req.params.leadId!);
    res.status(200).json(result);
  };

  /** Direção criativa de landing page -- não persiste nada. */
  directCreative = async (req: Request, res: Response): Promise<void> => {
    requireAuth(req);
    const direction = await this.ai.directCreative(req.body);
    res.status(200).json(direction);
  };

  draftMessage = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const message = await this.ai.draftMessage(
      auth.organizationId,
      auth.userId,
      req.params.leadId!,
      req.body,
    );
    res.status(201).json(message);
  };
}
