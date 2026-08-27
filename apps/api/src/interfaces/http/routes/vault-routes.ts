import { Router, type RequestHandler } from "express";
import { unlockVaultSchema } from "../../../application/dto/personal-vault.dto.js";
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
 */
export function createVaultRoutes(
  controller: PersonalVaultController,
  authenticate: RequestHandler,
  requireVault: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

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
