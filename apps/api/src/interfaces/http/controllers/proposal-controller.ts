import type { Request, Response } from "express";
import type { ListProposalsQuery } from "../../../application/dto/proposal.dto.js";
import type { ProposalService } from "../../../application/services/proposal-service.js";
import { requireAuth } from "../require-auth.js";

export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const proposal = await this.proposals.create(auth.organizationId, auth.userId, req.body);
    res.status(201).json(proposal);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListProposalsQuery;
    const result = await this.proposals.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const proposal = await this.proposals.get(auth.organizationId, req.params.id!);
    res.status(200).json(proposal);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const proposal = await this.proposals.update(
      auth.organizationId,
      auth.userId,
      req.params.id!,
      req.body,
    );
    res.status(200).json(proposal);
  };
}
