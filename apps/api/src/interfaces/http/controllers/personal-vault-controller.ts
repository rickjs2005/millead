import type { Request, Response } from "express";
import type { UnlockVaultInput } from "../../../application/dto/personal-vault.dto.js";
import type { PersonalVaultService } from "../../../application/services/personal-vault-service.js";
import { getRequestMeta } from "../request-meta.js";
import { requireAuth } from "../require-auth.js";

export class PersonalVaultController {
  constructor(private readonly vault: PersonalVaultService) {}

  status = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.vault.status(auth.userId));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const result = await this.vault.create(auth.userId, {
      organizationId: null,
      userId: auth.userId,
      ...getRequestMeta(req),
    });
    res.status(result.created ? 201 : 200).json(result);
  };

  unlock = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const { password } = req.body as UnlockVaultInput;
    const session = await this.vault.unlock(auth.userId, password, {
      organizationId: null,
      userId: auth.userId,
      ...getRequestMeta(req),
    });
    // O token vai no CORPO, e é o BFF do Next que o transforma em cookie
    // httpOnly. O JS do navegador nunca guarda a sessão elevada -- mesmo
    // desenho do access token (ver services/api-client.ts).
    res.status(200).json(session);
  };

  /**
   * "O Cofre está aberto?" -- primeira e mais simples rota sob `requireVault`.
   * Quem chega aqui já provou posse e sessão elevada, então a resposta é
   * sempre `{ open: true }`; o caso interessante é o erro (404 sem Cofre, 401
   * VAULT_LOCKED sem reautenticação), que o middleware produz antes.
   *
   * Existe porque o cookie da sessão elevada é httpOnly: o front não tem como
   * olhar pra ele e decidir sozinho se mostra a tela bloqueada. Perguntar ao
   * servidor também é o que faz o estado sobreviver a um F5.
   */
  session = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ open: true });
  };

  lock = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.vault.lock(auth.userId, {
      organizationId: null,
      userId: auth.userId,
      ...getRequestMeta(req),
    });
    res.status(204).send();
  };
}
