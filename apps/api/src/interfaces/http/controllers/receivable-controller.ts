import type { Request, Response } from "express";
import type { ReceivableService } from "../../../application/services/receivable-service.js";
import type {
  ReceivableQuery,
  ReceivableSeriesQuery,
} from "../../../application/dto/receivable.dto.js";
import { ValidationError } from "../../../domain/errors/app-error.js";
import { requireAuth } from "../require-auth.js";

export class ReceivableController {
  constructor(private readonly receivables: ReceivableService) {}

  createPlan = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(201).json(await this.receivables.createPlan(auth.organizationId, req.body));
  };

  createStandalone = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(201).json(await this.receivables.createStandalone(auth.organizationId, req.body));
  };

  listStandalone = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.receivables.listStandalone(auth.organizationId));
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { contractId } = req.validatedQuery as ReceivableQuery;

    if (contractId) {
      // Com contractId: lista parcelas do contrato
      res.status(200).json(await this.receivables.listByContract(auth.organizationId, contractId));
    } else {
      // Sem contractId: lista contratos com totais agregados
      res.status(200).json(await this.receivables.listContracts(auth.organizationId));
    }
  };

  summary = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { month } = req.validatedQuery as ReceivableQuery;
    res.status(200).json(await this.receivables.summary(auth.organizationId, month));
  };

  series = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { months } = req.validatedQuery as ReceivableSeriesQuery;
    res.status(200).json(await this.receivables.series(auth.organizationId, months));
  };

  margin = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { contractId } = req.validatedQuery as ReceivableQuery;

    if (!contractId) {
      throw new ValidationError("contractId é obrigatório para consulta de margem");
    }

    res.status(200).json(await this.receivables.margin(auth.organizationId, contractId));
  };

  pay = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(200)
      .json(await this.receivables.pay(auth.organizationId, req.params.id!, req.body));
  };

  unpay = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.receivables.unpay(auth.organizationId, req.params.id!));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(200)
      .json(await this.receivables.update(auth.organizationId, req.params.id!, req.body));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.receivables.remove(auth.organizationId, req.params.id!);
    res.status(204).end();
  };
}
