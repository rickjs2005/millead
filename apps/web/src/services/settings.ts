import { api } from "./api-client";
import type { IntegrationsStatusResult } from "@/types/api";

export const settingsService = {
  updateProfile: (payload: { name: string }) =>
    api.patch<{ id: string; name: string; email: string }>("/api/v1/settings/profile", payload),

  updateOrganization: (payload: { name: string }) =>
    api.patch<{ id: string; name: string; slug: string }>(
      "/api/v1/settings/organization",
      payload,
    ),

  getIntegrations: () => api.get<IntegrationsStatusResult>("/api/v1/settings/integrations"),
};
