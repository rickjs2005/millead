import type { Request, Response } from "express";
import type { ListLandingPagesQuery } from "../../../application/dto/landing-page.dto.js";
import type { LandingPageService } from "../../../application/services/landing-page-service.js";
import { requireAuth } from "../require-auth.js";

export class LandingPageController {
  constructor(private readonly pages: LandingPageService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const page = await this.pages.create(auth.organizationId, auth.userId, req.body);
    // 202: a geração roda no worker; o front acompanha por polling.
    res.status(202).json(page);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListLandingPagesQuery;
    const result = await this.pages.list(auth.organizationId, filters, { page, pageSize });
    res.status(200).json(result);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.pages.get(auth.organizationId, req.params.id!));
  };

  regenerate = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const page = await this.pages.regenerate(auth.organizationId, req.params.id!, req.body.brief);
    res.status(202).json(page);
  };

  publish = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const page = await this.pages.setPublished(
      auth.organizationId,
      req.params.id!,
      req.body.published,
    );
    res.status(200).json(page);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.pages.delete(auth.organizationId, req.params.id!);
    res.status(204).end();
  };

  /** Rota pública (sem auth): serve o HTML publicado. */
  servePublic = async (req: Request, res: Response): Promise<void> => {
    const html = await this.pages.servePublic(req.params.slug!);
    if (!html) {
      res.status(404).type("html").send("<h1>Página não encontrada</h1>");
      return;
    }
    res.status(200).type("html").send(html);
  };
}
