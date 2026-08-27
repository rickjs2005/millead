import type { Request, Response } from "express";
import type { PostSaleOnboardingService } from "../../../application/services/post-sale-onboarding-service.js";
import type { PostSaleSettingsService } from "../../../application/services/post-sale-settings-service.js";
import { requireAuth } from "../require-auth.js";

export class PostSaleController {
  constructor(
    private readonly settings: PostSaleSettingsService,
    private readonly onboarding: PostSaleOnboardingService,
  ) {}

  // ---- Configuração (Configurações > Automação) ----

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.settings.get(auth.organizationId));
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.settings.update(auth.organizationId, req.body));
  };

  listMembers = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json({ members: await this.settings.listMembers(auth.organizationId) });
  };

  // ---- Execução (tela do contrato) ----

  /** 200 com `null` quando o contrato nunca disparou a automação -- não é um
   *  404: o contrato existe, só não tem execução. A tela usa isso pra
   *  mostrar "nenhuma automação" em vez de um estado de erro. */
  getExecution = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const execution = await this.onboarding.getByContract(auth.organizationId, req.params.id!);
    res.status(200).json({ execution });
  };

  reprocess = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const execution = await this.onboarding.reprocess(
      auth.organizationId,
      req.params.id!,
      auth.userId,
    );
    // 202: as etapas rodam no worker, não nesta requisição.
    res.status(202).json({ execution });
  };
}
