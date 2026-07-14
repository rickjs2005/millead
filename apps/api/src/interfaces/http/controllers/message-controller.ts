import type { Request, Response } from "express";
import type { ListMessagesQuery } from "../../../application/dto/message.dto.js";
import type { MessageService } from "../../../application/services/message-service.js";
import { requireAuth } from "../require-auth.js";

export class MessageController {
  constructor(private readonly messages: MessageService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListMessagesQuery;
    const result = await this.messages.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const message = await this.messages.update(
      auth.organizationId,
      auth.userId,
      req.params.id!,
      req.body,
    );
    res.status(200).json(message);
  };

  listTemplates = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.messages.listTemplates(auth.organizationId));
  };

  createTemplate = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const template = await this.messages.createTemplate(auth.organizationId, req.body);
    res.status(201).json(template);
  };

  updateTemplate = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const template = await this.messages.updateTemplate(
      auth.organizationId,
      req.params.id!,
      req.body,
    );
    res.status(200).json(template);
  };
}
