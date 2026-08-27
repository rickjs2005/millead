import type { Request, Response } from "express";
import type {
  BridgeQuery,
  PushExpenseBody,
} from "../../../application/dto/business-expense.dto.js";
import type { CostService } from "../../../application/services/cost-service.js";
import type { PersonalBridgeService } from "../../../application/services/personal-bridge-service.js";
import { requireAuth } from "../require-auth.js";
import { requireVaultContext } from "../require-vault-context.js";

/**
 * A ponte, do lado do Cofre.
 *
 * É o único controller que lê `req.vault` **e** `req.auth.organizationId` no
 * mesmo método — os dois lados da fronteira. Por isso ele mora sozinho, em vez
 * de virar mais alguns métodos no `PersonalFinanceController`: lá a
 * propriedade que se lê de bater o olho é "nenhum método toca no mundo da
 * organização", e ela vale a pena continuar valendo.
 *
 * A organização é sempre a do token — nunca vem do corpo da requisição. Aceitar
 * um `organizationId` de fora permitiria mandar despesa pra uma organização em
 * que a pessoa não tem permissão nenhuma, já que o `requirePermission` da rota
 * confere as permissões da organização do token, não a de um campo do JSON.
 */
export class PersonalBridgeController {
  constructor(
    private readonly bridge: PersonalBridgeService,
    private readonly costs: CostService,
  ) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const { from, to } = req.validatedQuery as BridgeQuery;
    res.json(await this.bridge.list(vaultId, { from, to }));
  };

  listPlans = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    // Só o que o Cofre precisa pra montar o seletor. A lista completa de
    // custos tem cliente, capacidade e créditos -- nada disso ajuda aqui.
    const plans = await this.costs.listSubscriptions(auth.organizationId);
    res.json(
      plans
        .filter((p) => p.isActive)
        .map((p) => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          currency: p.currency,
          billingCycle: p.billingCycle,
        })),
    );
  };

  status = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.bridge.status(vaultId, req.params.id!));
  };

  push = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    const auth = requireAuth(req);
    res
      .status(201)
      .json(
        await this.bridge.push(
          vaultId,
          auth.organizationId,
          req.params.id!,
          req.body as PushExpenseBody,
        ),
      );
  };

  sync = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.bridge.sync(vaultId, req.params.id!));
  };

  revert = async (req: Request, res: Response): Promise<void> => {
    const { vaultId } = requireVaultContext(req);
    res.json(await this.bridge.revert(vaultId, req.params.id!));
  };
}
