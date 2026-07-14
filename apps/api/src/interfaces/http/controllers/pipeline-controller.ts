import type { Request, Response } from "express";
import type { PipelineService } from "../../../application/services/pipeline-service.js";
import { requireAuth } from "../require-auth.js";

export class PipelineController {
  constructor(private readonly pipelines: PipelineService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const pipelines = await this.pipelines.list(auth.organizationId);
    res.status(200).json(pipelines);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const pipeline = await this.pipelines.get(auth.organizationId, req.params.id!);
    res.status(200).json(pipeline);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const pipeline = await this.pipelines.create(
      auth.organizationId,
      req.body.name,
      req.body.isDefault,
    );
    res.status(201).json(pipeline);
  };

  addStage = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const stage = await this.pipelines.addStage(auth.organizationId, req.params.id!, req.body);
    res.status(201).json(stage);
  };
}
