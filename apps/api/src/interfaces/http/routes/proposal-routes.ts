import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import {
  createProposalSchema,
  listProposalsQuerySchema,
  rejectPublicSchema,
  updateProposalSchema,
} from "../../../application/dto/proposal.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { ProposalController } from "../controllers/proposal-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createProposalRoutes(
  controller: ProposalController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  router.post("/", write, validateBody(createProposalSchema), asyncHandler(controller.create));
  router.get("/", read, validateQuery(listProposalsQuerySchema), asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.patch("/:id", write, validateBody(updateProposalSchema), asyncHandler(controller.update));

  return router;
}

/**
 * Vista + decisão pública da proposta (/p/:token) -- SEM auth, protegida só
 * pela imprevisibilidade do token. Rate-limit mais apertado na decisão
 * (aceite/recusa) do que na leitura, já que decisões são ações irreversíveis.
 */
export function createPublicProposalRoutes(controller: ProposalController): Router {
  const router = Router();

  const readLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um minuto." } },
  });
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    message: { error: { code: "RATE_LIMITED", message: "Muitas tentativas. Aguarde um minuto." } },
  });

  router.get("/proposals/:token", readLimiter, asyncHandler(controller.getPublic));
  router.post("/proposals/:token/accept", writeLimiter, asyncHandler(controller.acceptPublic));
  router.post(
    "/proposals/:token/reject",
    writeLimiter,
    validateBody(rejectPublicSchema),
    asyncHandler(controller.rejectPublic),
  );

  return router;
}
