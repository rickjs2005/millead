import type { Request, Response } from "express";
import type { ListLeadsQuery } from "../../../application/dto/lead.dto.js";
import type { LeadService } from "../../../application/services/lead-service.js";
import type { PaginationQuery } from "../../../application/dto/pagination.dto.js";
import { requireAuth } from "../require-auth.js";

export class LeadController {
  constructor(private readonly leads: LeadService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const lead = await this.leads.create(auth.organizationId, auth.userId, req.body);
    res.status(201).json(lead);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListLeadsQuery;
    const result = await this.leads.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  finance = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.leads.finance(auth.organizationId));
  };

  recentActivities = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.leads.recentActivities(auth.organizationId));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const lead = await this.leads.get(auth.organizationId, req.params.id!);
    res.status(200).json(lead);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const lead = await this.leads.update(auth.organizationId, req.params.id!, req.body);
    res.status(200).json(lead);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.leads.delete(auth.organizationId, req.params.id!);
    res.status(204).send();
  };

  moveStage = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const lead = await this.leads.moveStage(
      auth.organizationId,
      auth.userId,
      req.params.id!,
      req.body.pipelineStageId,
    );
    res.status(200).json(lead);
  };

  addContact = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const contact = await this.leads.addContact(auth.organizationId, req.params.id!, req.body);
    res.status(201).json(contact);
  };

  removeContact = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.leads.removeContact(auth.organizationId, req.params.id!, req.params.contactId!);
    res.status(204).send();
  };

  addNote = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const note = await this.leads.addNote(
      auth.organizationId,
      auth.userId,
      req.params.id!,
      req.body.body,
    );
    res.status(201).json(note);
  };

  addTag = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.leads.addTag(auth.organizationId, req.params.id!, req.body.tagId);
    res.status(204).send();
  };

  removeTag = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.leads.removeTag(auth.organizationId, req.params.id!, req.params.tagId!);
    res.status(204).send();
  };

  listActivities = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize } = req.validatedQuery as PaginationQuery;
    const result = await this.leads.listActivities(auth.organizationId, req.params.id!, {
      page,
      pageSize,
    });
    res.status(200).json(result);
  };
}
