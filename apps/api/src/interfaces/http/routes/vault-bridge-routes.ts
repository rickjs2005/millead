import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  bridgeQuerySchema,
  pushExpenseSchema,
} from "../../../application/dto/business-expense.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { PersonalBridgeController } from "../controllers/personal-bridge-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

/**
 * A ponte entre o Cofre e o financeiro da MilWeb.
 *
 * ## Por que este router existe separado
 *
 * É o **único lugar do Cofre com RBAC**, e a exceção precisa ser visível.
 * `vault-data-routes.ts` tem a invariante "nenhuma rota aqui tem
 * `requirePermission`", com teste — misturar estas rotas lá tornaria a
 * invariante falsa e o teste teria de virar uma lista de exceções, que é
 * exatamente o tipo de coisa que cresce sem ninguém notar.
 *
 * ## Por que a exceção é correta
 *
 * O Cofre não tem RBAC porque os dados dele não são da organização — são do
 * dono, e a autorização é posse do Cofre mais sessão elevada. Mas **escrever
 * no financeiro da empresa é escrever dado da organização**, e aí vale o RBAC
 * normal: quem não pode lançar custo pelo Centro de Custos também não pode
 * lançar pelo Cofre. Sem isso, a ponte seria um caminho para contornar a
 * permissão do financeiro.
 *
 * A permissão usada é a mesma do módulo de custos (`proposals:read/write`) —
 * não uma chave nova. Chave nova entraria automaticamente em
 * `ADMIN_PERMISSIONS` e daria a todo Admin de toda organização um poder que
 * ninguém decidiu conceder.
 *
 * As três camadas se somam: `authenticate` (quem é), `requireVault` (o Cofre é
 * seu e está aberto) e `requirePermission` (você pode mexer no financeiro
 * desta organização).
 */
export function createVaultBridgeRoutes(
  controller: PersonalBridgeController,
  authenticate: RequestHandler,
  requireVault: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate, requireVault);

  const readFinance = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const writeFinance = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  // Compras com parte empresarial e o estado de cada uma na ponte.
  router.get(
    "/business/allocations",
    readFinance,
    validateQuery(bridgeQuerySchema),
    asyncHandler(controller.list),
  );
  // Os planos de custo da organização, pra escolher o que a despesa realiza.
  router.get("/business/plans", readFinance, asyncHandler(controller.listPlans));

  router.get("/business/allocations/:id", readFinance, asyncHandler(controller.status));
  router.post(
    "/business/allocations/:id",
    writeFinance,
    validateBody(pushExpenseSchema),
    asyncHandler(controller.push),
  );
  router.post("/business/allocations/:id/sync", writeFinance, asyncHandler(controller.sync));
  router.delete("/business/allocations/:id", writeFinance, asyncHandler(controller.revert));

  return router;
}
