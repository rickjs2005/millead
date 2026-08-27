import type { Request, Response } from "express";
import type {
  CreateExpenseBody,
  ExpenseQuery,
  ExpenseSummaryQuery,
  UpdateExpenseBody,
} from "../../../application/dto/business-expense.dto.js";
import type { BusinessExpenseService } from "../../../application/services/business-expense-service.js";
import { requireAuth } from "../require-auth.js";

/**
 * Despesas realizadas da MilWeb — o lado empresarial da ponte.
 *
 * Vive fora do Cofre e é guardado pelo RBAC normal do financeiro. Nenhum
 * método aqui recebe `vaultId`, e isso é a garantia estrutural de que quem
 * está no financeiro não alcança o Cofre por este caminho.
 */
export class BusinessExpenseController {
  constructor(private readonly expenses: BusinessExpenseService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const query = req.validatedQuery as ExpenseQuery;
    res.json(await this.expenses.list(auth.organizationId, query));
  };

  summary = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { from, to } = req.validatedQuery as ExpenseSummaryQuery;
    res.json(await this.expenses.summary(auth.organizationId, { from, to }));
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.json(await this.expenses.get(auth.organizationId, req.params.id!));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(201)
      .json(await this.expenses.create(auth.organizationId, req.body as CreateExpenseBody));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.json(
      await this.expenses.update(
        auth.organizationId,
        req.params.id!,
        req.body as UpdateExpenseBody,
      ),
    );
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.expenses.delete(auth.organizationId, req.params.id!);
    res.status(204).end();
  };
}
