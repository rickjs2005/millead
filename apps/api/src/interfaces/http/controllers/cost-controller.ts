import type { Request, Response } from "express";
import type { CostService } from "../../../application/services/cost-service.js";
import { requireAuth } from "../require-auth.js";

export class CostController {
  constructor(private readonly costs: CostService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.listSubscriptions(auth.organizationId));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(201).json(await this.costs.createSubscription(auth.organizationId, req.body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(200)
      .json(await this.costs.updateSubscription(auth.organizationId, req.params.id!, req.body));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.costs.deleteSubscription(auth.organizationId, req.params.id!);
    res.status(204).end();
  };

  catalog = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.listCatalog(auth.organizationId));
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.getSettings(auth.organizationId));
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.updateSettings(auth.organizationId, req.body));
  };

  summary = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.getSummary(auth.organizationId));
  };
}
