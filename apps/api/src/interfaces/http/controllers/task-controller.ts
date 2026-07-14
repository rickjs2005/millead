import type { Request, Response } from "express";
import type { ListTasksQuery } from "../../../application/dto/task.dto.js";
import type { TaskService } from "../../../application/services/task-service.js";
import { requireAuth } from "../require-auth.js";

export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const task = await this.tasks.create(auth.organizationId, req.body);
    res.status(201).json(task);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListTasksQuery;
    const result = await this.tasks.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const task = await this.tasks.get(auth.organizationId, req.params.id!);
    res.status(200).json(task);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const task = await this.tasks.update(auth.organizationId, req.params.id!, req.body);
    res.status(200).json(task);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.tasks.delete(auth.organizationId, req.params.id!);
    res.status(204).send();
  };
}
