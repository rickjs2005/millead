import type { Request, Response } from "express";
import type { CostService } from "../../../application/services/cost-service.js";
import type { UsageQuery, UsageSeriesQuery } from "../../../application/dto/cost.dto.js";
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

  listUsage = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { month } = req.validatedQuery as UsageQuery;
    res.status(200).json(await this.costs.listUsage(auth.organizationId, month));
  };

  createUsage = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(201).json(await this.costs.createUsage(auth.organizationId, req.body));
  };

  removeUsage = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.costs.deleteUsage(auth.organizationId, req.params.id!);
    res.status(204).end();
  };

  usageSummary = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { month } = req.validatedQuery as UsageQuery;
    res.status(200).json(await this.costs.getUsageSummary(auth.organizationId, month));
  };

  usageSeries = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { months } = req.validatedQuery as UsageSeriesQuery;
    res.status(200).json(await this.costs.getUsageSeries(auth.organizationId, months));
  };
}
