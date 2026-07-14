import type { Request, Response } from "express";
import type { TagService } from "../../../application/services/tag-service.js";
import { requireAuth } from "../require-auth.js";

export class TagController {
  constructor(private readonly tags: TagService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const tags = await this.tags.list(auth.organizationId);
    res.status(200).json(tags);
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const tag = await this.tags.create(auth.organizationId, req.body.name, req.body.color);
    res.status(201).json(tag);
  };
}
