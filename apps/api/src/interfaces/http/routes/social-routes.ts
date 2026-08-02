import { timingSafeEqual } from "node:crypto";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { setFormatSchema } from "../../../application/dto/social.dto.js";
import { UnauthorizedError } from "../../../domain/errors/app-error.js";
import { asyncHandler } from "../async-handler.js";
import type { SocialController } from "../controllers/social-controller.js";
import { validateBody } from "../middlewares/validate.js";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * /sync aceita DUAS formas de auth: sessao do dono (authenticate+requireOwner)
 * OU header X-Sync-Key (cron do n8n, sem sessao). Header presente decide a
 * rota de auth na hora -- invalido e 401 direto, sem fallback pra sessao.
 */
function ownerOrSyncKey(
  syncKey: string | undefined,
  authenticate: RequestHandler,
  requireOwner: RequestHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["x-sync-key"];
    if (typeof header === "string") {
      if (syncKey && safeEqual(header, syncKey)) { next(); return; }
      next(new UnauthorizedError("Chave de sincronização inválida."));
      return;
    }
    authenticate(req, res, (err?: unknown) => {
      if (err) { next(err); return; }
      requireOwner(req, res, next);
    });
  };
}

export function createSocialRoutes(
  controller: SocialController,
  authenticate: RequestHandler,
  requireOwner: RequestHandler,
  syncKey: string | undefined,
): Router {
  const router = Router();

  router.post("/sync", ownerOrSyncKey(syncKey, authenticate, requireOwner), asyncHandler(controller.sync));

  // Demais rotas: sempre sessao do dono.
  router.use(authenticate, requireOwner);
  router.get("/posts", asyncHandler(controller.listPosts));
  router.get("/posts/:id/series", asyncHandler(controller.series));
  router.patch("/posts/:id/format", validateBody(setFormatSchema), asyncHandler(controller.setFormat));
  router.get("/comparison", asyncHandler(controller.comparison));
  router.post("/analysis", asyncHandler(controller.analysis));
  return router;
}
