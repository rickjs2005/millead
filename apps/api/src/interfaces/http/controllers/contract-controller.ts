import type { Request, Response } from "express";
import type { ListContractsQuery } from "../../../application/dto/contract.dto.js";
import type { ContractService } from "../../../application/services/contract-service.js";
import { requireAuth } from "../require-auth.js";

export class ContractController {
  constructor(private readonly service: ContractService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const contract = await this.service.create(auth.organizationId, auth.userId, req.body, "APP");
    // 202: PDF + assinatura rodam no worker.
    res.status(202).json(contract);
  };

  createPublic = async (req: Request, res: Response): Promise<void> => {
    const { organizationSlug, ...data } = req.body;
    const contract = await this.service.createPublic(organizationSlug, data);
    // Resposta enxuta: o formulário público não deve receber o objeto todo.
    res.status(202).json({ numero: contract.numero, status: contract.status });
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { page, pageSize, ...filters } = req.validatedQuery as ListContractsQuery;
    res.status(200).json(await this.service.list(auth.organizationId, filters, { page, pageSize }));
  };

  kpis = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.service.kpis(auth.organizationId));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.service.get(auth.organizationId, req.params.id!));
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(200)
      .json(await this.service.updateStatus(auth.organizationId, req.params.id!, req.body.status));
  };

  reprocess = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(202).json(await this.service.reprocess(auth.organizationId, req.params.id!));
  };

  pdf = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const versao = req.query.versao === "assinado" ? "assinado" : "original";
    const pdf = await this.service.getPdf(auth.organizationId, req.params.id!, versao);
    res
      .status(200)
      .type("application/pdf")
      .setHeader("Content-Disposition", `inline; filename="contrato-${versao}.pdf"`)
      .send(pdf);
  };

  signatureWebhook = async (req: Request, res: Response): Promise<void> => {
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
    const result = await this.service.handleSignatureWebhook(req.headers, rawBody, req.body);
    res.status(200).json(result);
  };
}
