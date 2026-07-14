import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { errorHandler } from "../interfaces/http/middlewares/error-handler.js";
import { createAiRoutes } from "../interfaces/http/routes/ai-routes.js";
import { createAuditRoutes } from "../interfaces/http/routes/audit-routes.js";
import { createAuthRoutes } from "../interfaces/http/routes/auth-routes.js";
import {
  createLandingPageRoutes,
  createPublicLandingPageRoutes,
} from "../interfaces/http/routes/landing-page-routes.js";
import { createMessageRoutes } from "../interfaces/http/routes/message-routes.js";
import { createCompanyRoutes } from "../interfaces/http/routes/company-routes.js";
import { createHealthRoutes } from "../interfaces/http/routes/health-routes.js";
import { createLeadRoutes } from "../interfaces/http/routes/lead-routes.js";
import { createMeetingRoutes } from "../interfaces/http/routes/meeting-routes.js";
import { createPipelineRoutes } from "../interfaces/http/routes/pipeline-routes.js";
import { createProposalRoutes } from "../interfaces/http/routes/proposal-routes.js";
import { createTagRoutes } from "../interfaces/http/routes/tag-routes.js";
import { createTaskRoutes } from "../interfaces/http/routes/task-routes.js";
import type { Container } from "./container.js";

/**
 * Fábrica do app Express, separada de `server.ts` (que só chama
 * `.listen()`) -- permite testes de integração importarem `app` sem abrir
 * uma porta de verdade.
 */
export function createApp(container: Container): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true); // necessário pra req.ip funcionar atrás de proxy/load balancer
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.use(createHealthRoutes());
  app.use("/api/v1/ai", createAiRoutes(container.aiController, container.authenticate));
  app.use("/api/v1/audits", createAuditRoutes(container.auditController, container.authenticate));
  app.use(
    "/api/v1/messages",
    createMessageRoutes(container.messageController, container.authenticate),
  );
  app.use(
    "/api/v1/landing-pages",
    createLandingPageRoutes(container.landingPageController, container.authenticate),
  );
  // Rota PÚBLICA da landing page -- o link que o prospect abre, sem login.
  app.use("/p", createPublicLandingPageRoutes(container.landingPageController));
  app.use("/api/v1/auth", createAuthRoutes(container.authController, container.authenticate));
  app.use(
    "/api/v1/companies",
    createCompanyRoutes(container.companyController, container.authenticate),
  );
  app.use("/api/v1/leads", createLeadRoutes(container.leadController, container.authenticate));
  app.use(
    "/api/v1/meetings",
    createMeetingRoutes(container.meetingController, container.authenticate),
  );
  app.use(
    "/api/v1/pipelines",
    createPipelineRoutes(container.pipelineController, container.authenticate),
  );
  app.use(
    "/api/v1/proposals",
    createProposalRoutes(container.proposalController, container.authenticate),
  );
  app.use("/api/v1/tags", createTagRoutes(container.tagController, container.authenticate));
  app.use("/api/v1/tasks", createTaskRoutes(container.taskController, container.authenticate));

  app.use((req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: `Rota não encontrada: ${req.path}` } });
  });
  app.use(errorHandler);

  return app;
}
