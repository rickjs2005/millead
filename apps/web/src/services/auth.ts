import { api } from "./api-client";
import type { CurrentUserResult, OrganizationChoiceRequired, SessionResult } from "@/types/api";

export interface RegisterPayload {
  organizationName: string;
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  organizationSlug?: string;
}

export const authService = {
  register: (payload: RegisterPayload) =>
    api.post<SessionResult>("/api/v1/auth/register", payload, { skipAuth: true }),

  login: (payload: LoginPayload) =>
    api.post<SessionResult | OrganizationChoiceRequired>("/api/v1/auth/login", payload, {
      skipAuth: true,
    }),

  logout: (refreshToken: string) =>
    api.post<void>("/api/v1/auth/logout", { refreshToken }, { skipAuth: true }),

  me: () => api.get<CurrentUserResult>("/api/v1/auth/me"),
};

export function isOrganizationChoice(
  result: SessionResult | OrganizationChoiceRequired,
): result is OrganizationChoiceRequired {
  return "requiresOrganizationSelection" in result;
}
