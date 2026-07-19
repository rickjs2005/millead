import { api } from "./api-client";
import type { CurrentUserResult, OrganizationChoiceRequired } from "@/types/api";

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

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/**
 * Endpoints de auth batem no BFF (`/api/bff/auth/*`), não direto na API: o BFF
 * troca os tokens por cookies httpOnly e devolve só os dados públicos da
 * sessão. Por isso o retorno é `CurrentUserResult` (sem tokens), não
 * `SessionResult`. `me` passa pelo proxy autenticado por cookie.
 */
export const authService = {
  register: (payload: RegisterPayload) =>
    api.post<CurrentUserResult>("/auth/register", payload, { skipAuth: true }),

  login: (payload: LoginPayload) =>
    api.post<CurrentUserResult | OrganizationChoiceRequired>("/auth/login", payload, {
      skipAuth: true,
    }),

  logout: () => api.post<void>("/auth/logout", undefined, { skipAuth: true }),

  me: () => api.get<CurrentUserResult>("/api/v1/auth/me"),

  changePassword: (payload: ChangePasswordPayload) =>
    api.post<void>("/api/v1/auth/change-password", payload),
};

export function isOrganizationChoice(
  result: CurrentUserResult | OrganizationChoiceRequired,
): result is OrganizationChoiceRequired {
  return "requiresOrganizationSelection" in result;
}
