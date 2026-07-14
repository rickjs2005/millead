import type { Request, Response } from "express";
import type { ListAuditsQuery } from "../../../application/dto/audit.dto.js";
import type { AuditService } from "../../../application/services/audit-service.js";
import { requireAuth } from "../require-auth.js";

export class AuditController {
  constructor(private readonly audits: AuditService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const audit = await this.audits.request(auth.organizationId, auth.userId, req.body.companyId);
    // 202: aceito pra processamento -- o resultado sai depois, via worker.
    res.status(202).json(audit);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListAuditsQuery;
    const result = await this.audits.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const audit = await this.audits.get(auth.organizationId, req.params.id!);
    res.status(200).json(audit);
  };
}
