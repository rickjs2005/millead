import type { Request, Response } from "express";
import type {
  ConfirmFileRequest,
  CreateBriefingRequest,
  ListBriefingsQuery,
  RemoveGroupItemRequest,
  SaveAnswerRequest,
  UploadTokenRequest,
} from "../../../application/dto/briefing.dto.js";
import type { BriefingAnswerService } from "../../../application/services/briefing-answer-service.js";
import type { BriefingCompletionService } from "../../../application/services/briefing-completion-service.js";
import type { BriefingFileService } from "../../../application/services/briefing-file-service.js";
import type { BriefingService } from "../../../application/services/briefing-service.js";
import { requireAuth } from "../require-auth.js";

export class BriefingController {
  constructor(
    private readonly service: BriefingService,
    private readonly answers: BriefingAnswerService,
    private readonly completion: BriefingCompletionService,
    private readonly files: BriefingFileService,
  ) {}

  // ---------- admin (autenticado) ----------

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const body = req.body as CreateBriefingRequest;
    const briefing = await this.service.create(auth.organizationId, auth.userId, body);
    res.status(201).json(briefing);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListBriefingsQuery;
    res.status(200).json(await this.service.list(auth.organizationId, filters, { page, pageSize }));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.service.get(auth.organizationId, req.params.id!));
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.service.archive(auth.organizationId, req.params.id!));
  };

  duplicate = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const copy = await this.service.duplicate(auth.organizationId, auth.userId, req.params.id!);
    res.status(201).json(copy);
  };

  resendEmail = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.service.resend(auth.organizationId, req.params.id!, "email"));
  };

  resendWhatsapp = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.service.resend(auth.organizationId, req.params.id!, "whatsapp"));
  };

  listTemplates = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.service.listTemplates());
  };

  getTemplate = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.service.getTemplate(req.params.key!));
  };

  // ---------- público (sem auth, resolve tudo via :token) ----------

  getPublic = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.answers.getByToken(req.params.token!));
  };

  saveAnswerPublic = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as SaveAnswerRequest;
    res.status(200).json(await this.answers.saveAnswer(req.params.token!, body));
  };

  removeGroupItemPublic = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as RemoveGroupItemRequest;
    res.status(200).json(await this.answers.removeGroupItem(req.params.token!, body.groupItemId));
  };

  uploadTokenPublic = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as UploadTokenRequest;
    res.status(200).json(await this.files.createUploadToken(req.params.token!, body));
  };

  confirmFilePublic = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as ConfirmFileRequest;
    const file = await this.files.confirmFile(req.params.token!, body);
    res.status(201).json(file);
  };

  completePublic = async (req: Request, res: Response): Promise<void> => {
    const briefing = await this.completion.complete(req.params.token!);
    res.status(200).json({ status: briefing.status });
  };
}
