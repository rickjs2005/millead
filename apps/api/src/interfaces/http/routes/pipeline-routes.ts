import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  addPipelineStageSchema,
  createPipelineSchema,
} from "../../../application/dto/pipeline.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { PipelineController } from "../controllers/pipeline-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

// Leitura da estrutura do pipeline (quais estágios existem) é pré-requisito
// pra operar leads no dia a dia -- por isso fica atrás de leads:read, não
// de pipelines:manage. Só criar/alterar a estrutura (pipeline/estágio
// novos) é que exige pipelines:manage (papel Sales não tem essa
// permissão de propósito -- estrutura de pipeline é decisão de admin).
export function createPipelineRoutes(
  controller: PipelineController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/", requirePermission(PERMISSIONS.LEADS_READ), asyncHandler(controller.list));
  router.get("/:id", requirePermission(PERMISSIONS.LEADS_READ), asyncHandler(controller.get));
  router.post(
    "/",
    requirePermission(PERMISSIONS.PIPELINES_MANAGE),
    validateBody(createPipelineSchema),
    asyncHandler(controller.create),
  );
  router.post(
    "/:id/stages",
    requirePermission(PERMISSIONS.PIPELINES_MANAGE),
    validateBody(addPipelineStageSchema),
    asyncHandler(controller.addStage),
  );

  return router;
}
