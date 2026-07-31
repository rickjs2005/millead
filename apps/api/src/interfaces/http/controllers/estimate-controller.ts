import type { Request, Response } from "express";
import type { ListEstimatesQuery } from "../../../application/dto/estimate.dto.js";
import type { EstimateService } from "../../../application/services/estimate-service.js";
import { requireAuth } from "../require-auth.js";

export class EstimateController {
  constructor(private readonly estimates: EstimateService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const query = req.validatedQuery as ListEstimatesQuery;
    res.status(200).json(await this.estimates.list(auth.organizationId, query));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.estimates.get(auth.organizationId, req.params.id!));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const estimate = await this.estimates.create(auth.organizationId, auth.userId, req.body);
    res.status(201).json(estimate);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(200)
      .json(await this.estimates.update(auth.organizationId, req.params.id!, req.body));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.estimates.delete(auth.organizationId, req.params.id!);
    res.status(204).end();
  };

  products = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.estimates.listProducts(auth.organizationId));
  };
}
