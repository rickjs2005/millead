import type { Request, Response } from "express";
import type { CompanyService } from "../../../application/services/company-service.js";
import type { ListCompaniesQuery } from "../../../application/dto/company.dto.js";
import { requireAuth } from "../require-auth.js";

export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const company = await this.companies.create(auth.organizationId, req.body);
    res.status(201).json(company);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, search } = req.validatedQuery as ListCompaniesQuery;
    const result = await this.companies.list(auth.organizationId, { search }, { page, pageSize });
    res.status(200).json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const company = await this.companies.get(auth.organizationId, req.params.id!);
    res.status(200).json(company);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const company = await this.companies.update(auth.organizationId, req.params.id!, req.body);
    res.status(200).json(company);
  };

  addWebsite = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const website = await this.companies.addWebsite(
      auth.organizationId,
      req.params.id!,
      req.body.url,
      req.body.isPrimary,
    );
    res.status(201).json(website);
  };

  removeWebsite = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.companies.removeWebsite(auth.organizationId, req.params.id!, req.params.websiteId!);
    res.status(204).send();
  };

  addSocial = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const social = await this.companies.addSocial(
      auth.organizationId,
      req.params.id!,
      req.body.platform,
      req.body.handleOrUrl,
    );
    res.status(201).json(social);
  };

  removeSocial = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.companies.removeSocial(auth.organizationId, req.params.id!, req.params.socialId!);
    res.status(204).send();
  };
}
