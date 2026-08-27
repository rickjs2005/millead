import { Router, type RequestHandler } from "express";
import {
  addAliasSchema,
  createAccountSchema,
  createCardSchema,
  createCategorySchema,
  createMerchantSchema,
  createTransactionSchema,
  createTransferSchema,
  listQuerySchema,
  payStatementSchema,
  replaceSplitsSchema,
  statementQuerySchema,
  transactionQuerySchema,
  updateAccountSchema,
  updateCardSchema,
  updateCategorySchema,
  updateMerchantSchema,
  updateTransactionSchema,
} from "../../../application/dto/personal-finance.dto.js";
import {
  confirmImportSchema,
  createImportProfileSchema,
  importHistoryQuerySchema,
  previewImportSchema,
  updateImportProfileSchema,
} from "../../../application/dto/personal-import.dto.js";
import {
  classificationRunSchema,
  correctClassificationSchema,
  createRuleSchema,
  updateRuleSchema,
} from "../../../application/dto/personal-classification.dto.js";
import {
  createSubscriptionSchema,
  snoozeAlertSchema,
  subscriptionQuerySchema,
  updateSubscriptionSchema,
} from "../../../application/dto/personal-subscription.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { PersonalFinanceController } from "../controllers/personal-finance-controller.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

/**
 * Dados do Cofre. **Tudo aqui exige sessão elevada** — `requireVault` é
 * aplicado no router inteiro, uma vez, em vez de rota por rota: uma rota nova
 * criada amanhã nasce protegida por construção, e esquecer o middleware deixa
 * de ser possível.
 *
 * Nenhuma rota tem `requirePermission`, e isso é deliberado — ver o comentário
 * em `vault-routes.ts` sobre por que uma permissão nova entregaria o Cofre ao
 * papel Admin de toda organização.
 */
export function createVaultDataRoutes(
  controller: PersonalFinanceController,
  authenticate: RequestHandler,
  requireVault: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate, requireVault);

  const listQuery = validateQuery(listQuerySchema);

  // ----- Contas -----
  router.get("/accounts", listQuery, asyncHandler(controller.listAccounts));
  router.post(
    "/accounts",
    validateBody(createAccountSchema),
    asyncHandler(controller.createAccount),
  );
  router.get("/accounts/:id", asyncHandler(controller.getAccount));
  router.patch(
    "/accounts/:id",
    validateBody(updateAccountSchema),
    asyncHandler(controller.updateAccount),
  );
  router.delete("/accounts/:id", asyncHandler(controller.deleteAccount));

  // ----- Cartões -----
  router.get("/cards", listQuery, asyncHandler(controller.listCards));
  router.post("/cards", validateBody(createCardSchema), asyncHandler(controller.createCard));
  router.get("/cards/:id", asyncHandler(controller.getCard));
  router.patch("/cards/:id", validateBody(updateCardSchema), asyncHandler(controller.updateCard));
  router.delete("/cards/:id", asyncHandler(controller.deleteCard));

  // ----- Categorias -----
  router.get("/categories", listQuery, asyncHandler(controller.listCategories));
  router.post(
    "/categories",
    validateBody(createCategorySchema),
    asyncHandler(controller.createCategory),
  );
  router.patch(
    "/categories/:id",
    validateBody(updateCategorySchema),
    asyncHandler(controller.updateCategory),
  );
  router.delete("/categories/:id", asyncHandler(controller.deleteCategory));

  // ----- Fornecedores -----
  router.get("/merchants", listQuery, asyncHandler(controller.listMerchants));
  router.post(
    "/merchants",
    validateBody(createMerchantSchema),
    asyncHandler(controller.createMerchant),
  );
  router.get("/merchants/:id", asyncHandler(controller.getMerchant));
  router.patch(
    "/merchants/:id",
    validateBody(updateMerchantSchema),
    asyncHandler(controller.updateMerchant),
  );
  router.delete("/merchants/:id", asyncHandler(controller.deleteMerchant));
  router.post(
    "/merchants/:id/aliases",
    validateBody(addAliasSchema),
    asyncHandler(controller.addAlias),
  );
  router.delete("/merchants/:id/aliases/:aliasId", asyncHandler(controller.removeAlias));

  // ----- Movimentações -----
  // "/transactions/transfers" ANTES de "/transactions/:id": o Express casa na
  // ordem de declaração, e invertido "transfers" viraria um id.
  router.post(
    "/transactions/transfers",
    validateBody(createTransferSchema),
    asyncHandler(controller.createTransfer),
  );
  router.get(
    "/transactions",
    validateQuery(transactionQuerySchema),
    asyncHandler(controller.listTransactions),
  );
  router.post(
    "/transactions",
    validateBody(createTransactionSchema),
    asyncHandler(controller.createTransaction),
  );
  router.get("/transactions/:id", asyncHandler(controller.getTransaction));
  router.patch(
    "/transactions/:id",
    validateBody(updateTransactionSchema),
    asyncHandler(controller.updateTransaction),
  );
  router.delete("/transactions/:id", asyncHandler(controller.deleteTransaction));
  router.patch(
    "/transactions/:id/classification",
    validateBody(correctClassificationSchema),
    asyncHandler(controller.correctClassification),
  );
  router.put(
    "/transactions/:id/splits",
    validateBody(replaceSplitsSchema),
    asyncHandler(controller.replaceSplits),
  );

  // ----- Importação -----
  // "/imports/profiles" ANTES de qualquer "/imports/:id" que venha a existir.
  router.get("/imports/profiles", asyncHandler(controller.listImportProfiles));
  router.post(
    "/imports/profiles",
    validateBody(createImportProfileSchema),
    asyncHandler(controller.createImportProfile),
  );
  router.patch(
    "/imports/profiles/:id",
    validateBody(updateImportProfileSchema),
    asyncHandler(controller.updateImportProfile),
  );
  router.delete("/imports/profiles/:id", asyncHandler(controller.deleteImportProfile));

  // Pré-visualização NÃO grava nada: lê, interpreta e devolve o que entraria.
  router.post(
    "/imports/preview",
    validateBody(previewImportSchema),
    asyncHandler(controller.previewImport),
  );
  router.post(
    "/imports",
    validateBody(confirmImportSchema),
    asyncHandler(controller.confirmImport),
  );
  router.get(
    "/imports",
    validateQuery(importHistoryQuerySchema),
    asyncHandler(controller.listImports),
  );

  // ----- Classificação e regras -----
  router.get("/rules", listQuery, asyncHandler(controller.listRules));
  router.post("/rules", validateBody(createRuleSchema), asyncHandler(controller.createRule));
  router.patch("/rules/:id", validateBody(updateRuleSchema), asyncHandler(controller.updateRule));
  router.delete("/rules/:id", asyncHandler(controller.deleteRule));
  router.post(
    "/classification/run",
    validateBody(classificationRunSchema),
    asyncHandler(controller.runClassification),
  );

  // ----- Assinaturas -----
  router.get(
    "/subscriptions",
    validateQuery(subscriptionQuerySchema),
    asyncHandler(controller.listSubscriptions),
  );
  router.post(
    "/subscriptions",
    validateBody(createSubscriptionSchema),
    asyncHandler(controller.createSubscription),
  );
  router.get("/subscriptions/:id", asyncHandler(controller.getSubscription));
  router.patch(
    "/subscriptions/:id",
    validateBody(updateSubscriptionSchema),
    asyncHandler(controller.updateSubscription),
  );
  router.delete("/subscriptions/:id", asyncHandler(controller.deleteSubscription));

  // ----- Alertas -----
  // "/alerts/refresh" e "/alerts/count" ANTES de "/alerts/:id".
  router.post("/alerts/refresh", asyncHandler(controller.refreshAlerts));
  router.get("/alerts/count", asyncHandler(controller.countAlerts));
  router.get("/alerts", asyncHandler(controller.listAlerts));
  router.patch("/alerts/:id/read", asyncHandler(controller.markAlertRead));
  router.patch(
    "/alerts/:id/snooze",
    validateBody(snoozeAlertSchema),
    asyncHandler(controller.snoozeAlert),
  );

  // ----- Faturas -----
  router.get(
    "/statements",
    validateQuery(statementQuerySchema),
    asyncHandler(controller.listStatements),
  );
  router.get("/statements/:id", asyncHandler(controller.getStatement));
  router.post(
    "/statements/:id/payments",
    validateBody(payStatementSchema),
    asyncHandler(controller.payStatement),
  );

  return router;
}
