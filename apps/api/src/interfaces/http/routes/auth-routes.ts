import { Router, type RequestHandler } from "express";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from "../../../application/dto/auth.dto.js";
import type { AuthController } from "../controllers/auth-controller.js";
import { asyncHandler } from "../async-handler.js";
import { authRateLimit } from "../middlewares/rate-limit.js";
import { validateBody } from "../middlewares/validate.js";

export function createAuthRoutes(controller: AuthController, authenticate: RequestHandler): Router {
  const router = Router();

  router.post(
    "/register",
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

  return router;
}
