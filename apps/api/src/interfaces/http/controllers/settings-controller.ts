import type { Request, Response } from "express";
import type { SettingsService } from "../../../application/services/settings-service.js";
import { requireAuth } from "../require-auth.js";

export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.settings.updateProfile(auth.userId, req.body));
  };

  updateOrganization = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.settings.updateOrganization(auth.organizationId, req.body));
  };

  integrations = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(this.settings.getIntegrationsStatus());
  };
}
