import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  addCompanySocialSchema,
  addCompanyWebsiteSchema,
  createCompanySchema,
  listCompaniesQuerySchema,
  updateCompanySchema,
} from "../../../application/dto/company.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { CompanyController } from "../controllers/company-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody, validateQuery } from "../middlewares/validate.js";

export function createCompanyRoutes(
  controller: CompanyController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.post(
    "/",
    requirePermission(PERMISSIONS.COMPANIES_WRITE),
    validateBody(createCompanySchema),
    asyncHandler(controller.create),
  );
  router.get(
    "/",
    requirePermission(PERMISSIONS.COMPANIES_READ),
    validateQuery(listCompaniesQuerySchema),
    asyncHandler(controller.list),
  );
  router.get("/:id", requirePermission(PERMISSIONS.COMPANIES_READ), asyncHandler(controller.get));
  router.patch(
    "/:id",
    requirePermission(PERMISSIONS.COMPANIES_WRITE),
    validateBody(updateCompanySchema),
    asyncHandler(controller.update),
  );

  router.post(
    "/:id/websites",
    requirePermission(PERMISSIONS.COMPANIES_WRITE),
    validateBody(addCompanyWebsiteSchema),
    asyncHandler(controller.addWebsite),
  );
  router.delete(
    "/:id/websites/:websiteId",
    requirePermission(PERMISSIONS.COMPANIES_WRITE),
    asyncHandler(controller.removeWebsite),
  );

  router.post(
    "/:id/socials",
    requirePermission(PERMISSIONS.COMPANIES_WRITE),
    validateBody(addCompanySocialSchema),
    asyncHandler(controller.addSocial),
  );
  router.delete(
    "/:id/socials/:socialId",
    requirePermission(PERMISSIONS.COMPANIES_WRITE),
    asyncHandler(controller.removeSocial),
  );

  return router;
}
