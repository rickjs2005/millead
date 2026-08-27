import { Router, type RequestHandler } from "express";
import { unlockVaultSchema } from "../../../application/dto/personal-vault.dto.js";
import { NotFoundError } from "../../../domain/errors/app-error.js";
import type { VaultSessionService } from "../../../domain/services/vault-session-service.js";
import { asyncHandler } from "../async-handler.js";
import type { PersonalVaultController } from "../controllers/personal-vault-controller.js";
import { validateBody } from "../middlewares/validate.js";
import { vaultUnlockRateLimit } from "../middlewares/rate-limit.js";

/**
 * Cofre Financeiro. Sem `requirePermission` em nenhuma rota, e isso é
 * deliberado: adicionar uma chave ao catálogo de permissões a entregaria
 * automaticamente ao papel Admin de toda organização
 * (`ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(...)` em
 * packages/database/src/permissions.ts). A autorização aqui é posse do Cofre
 * + sessão elevada, e nada mais.
 *
 * As rotas de dados do Cofre (fases seguintes) montam sob `requireVault`.
 * Estas quatro são as de fora da porta: descobrir, criar, abrir e fechar.
 *
 * ## Sem `VAULT_SESSION_SECRET`, o módulo INTEIRO some
 *
 * `requireVault` já respondia 404 sem o segredo, mas ele só cobre as rotas de
 * dentro. As de fora da porta ficavam de pé: `/status` respondia 200 e
 * `/unlock` estourava **500**, porque `sign()` não tem como assinar sem
 * segredo.
 *
 * O 500 é o pior dos dois mundos. Pra quem usa, a tela mostra "Criar Cofre"
 * pra um Cofre que já existe e o botão de abrir quebra — um estado que parece
 * defeito do sistema, não configuração faltando. E pra quem sonda de fora, a
 * diferença entre 500 e 404 já denuncia que existe um módulo ali, meio
 * instalado.
 *
 * A guarda aqui fecha o router inteiro de uma vez: sem segredo, tudo é 404, e
 * o módulo fica indistinguível de um que nunca existiu. Encontrado no primeiro
 * deploy em produção, com a variável ainda ausente no Render.
 */
export function createVaultRoutes(
  controller: PersonalVaultController,
  authenticate: RequestHandler,
  requireVault: RequestHandler,
  sessions: Pick<VaultSessionService, "configured">,
): Router {
  const router = Router();
  router.use(authenticate);
  router.use((_req, _res, next) => {
    next(sessions.configured ? undefined : new NotFoundError("Rota não encontrada."));
  });

  router.get("/status", asyncHandler(controller.status));
  router.post("/", asyncHandler(controller.create));
  router.post(
    "/unlock",
    // Segunda trava, independente do lockout do banco: o bloqueio persistido
    // já segura o ataque por conta, e este limita o volume por processo --
    // inclusive as tentativas contra contas que nem têm Cofre, que nunca
    // chegam a incrementar contador nenhum.
    vaultUnlockRateLimit,
    validateBody(unlockVaultSchema),
    asyncHandler(controller.unlock),
  );
  router.post("/lock", asyncHandler(controller.lock));

  // A partir daqui, tudo exige sessão elevada. As rotas de dados das próximas
  // fases entram sob este mesmo `requireVault` -- nunca sob requirePermission.
  router.get("/session", requireVault, asyncHandler(controller.session));

  return router;
}
