import { Router, type RequestHandler } from "express";
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from "../../../application/dto/auth.dto.js";
import { env } from "../../../config/env.js";
import type { AuthController } from "../controllers/auth-controller.js";
import { asyncHandler } from "../async-handler.js";
import { authRateLimit } from "../middlewares/rate-limit.js";
import { validateBody } from "../middlewares/validate.js";

/** O MilLead é sistema INTERNO da MilWeb: com REGISTRATION_OPEN=false o
 *  registro público fecha (403) — flip temporário da env pra cadastrar
 *  alguém novo da equipe (Settings > Equipe ainda é stub). */
const registrationGate: RequestHandler = (_req, res, next) => {
  if (!env.REGISTRATION_OPEN) {
    res.status(403).json({
      error: {
        code: "REGISTRATION_CLOSED",
        message: "Registro desativado. Fale com o administrador da MilWeb.",
      },
    });
    return;
  }
  next();
};

export function createAuthRoutes(controller: AuthController, authenticate: RequestHandler): Router {
  const router = Router();

  router.post(
    "/register",
    registrationGate,
    authRateLimit,
    validateBody(registerSchema),
    asyncHandler(controller.register),
  );
  router.post("/login", authRateLimit, validateBody(loginSchema), asyncHandler(controller.login));
  router.post(
    "/refresh",
    authRateLimit,
    validateBody(refreshSchema),
    asyncHandler(controller.refresh),
  );
  router.post("/logout", validateBody(logoutSchema), asyncHandler(controller.logout));
  router.get("/me", authenticate, asyncHandler(controller.me));
  router.post(
    "/change-password",
    authRateLimit,
    authenticate,
    validateBody(changePasswordSchema),
    asyncHandler(controller.changePassword),
  );

  return router;
}
