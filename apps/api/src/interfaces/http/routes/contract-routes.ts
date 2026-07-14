import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import {
  createContractSchema,
  listContractsQuerySchema,
  publicCreateContractSchema,
  updateContractStatusSchema,
} from "../../../application/dto/contract.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { ContractController } from "../controllers/contract-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

/**
 * Rotas autenticadas. Reusa as permissões de propostas de propósito
 * (contrato é o desfecho comercial de uma proposta; permissão própria
 * exigiria re-seed do catálogo RBAC).
 */
export function createContractRoutes(
  controller: ContractController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  router.post("/", write, validateBody(createContractSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listContractsQuerySchema), asyncHandler(controller.list));
  router.get("/kpis", read, asyncHandler(controller.kpis));
  router.get("/:id", read, asyncHandler(controller.get));
  router.get("/:id/pdf", read, asyncHandler(controller.pdf));
  router.patch(
    "/:id/status",
    write,
    validateBody(updateContractStatusSchema),
    asyncHandler(controller.updateStatus),
  );
  router.post("/:id/reprocess", write, asyncHandler(controller.reprocess));

  return router;
}

/** Formulário público de fechamento -- SEM auth, com rate-limit por IP. */
export function createPublicContractRoutes(controller: ContractController): Router {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    // O app usa trust proxy (req.ip atrás de proxy); em produção o proxy
    // (Vercel/Render) define X-Forwarded-For confiável -- desliga só a
    // checagem paranóica da lib, não a limitação em si.
    validate: { trustProxy: false },
    message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um minuto." } },
  });
  router.post(
    "/contracts",
    limiter,
    validateBody(publicCreateContractSchema),
    asyncHandler(controller.createPublic),
  );
  return router;
}

/** Webhook do provedor de assinatura -- SEM auth (validado por HMAC/segredo). */
export function createSignatureWebhookRoutes(controller: ContractController): Router {
  const router = Router();
  router.post("/signature", asyncHandler(controller.signatureWebhook));
  return router;
}
