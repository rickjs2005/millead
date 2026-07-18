import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrganizationRef, PermissionKey, PublicUser, RoleRef } from "@/types/api";

interface AuthState {
  user: PublicUser | null;
  organization: OrganizationRef | null;
  role: RoleRef | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (session: {
    user: PublicUser;
    organization: OrganizationRef;
    role: RoleRef;
    accessToken: string;
    refreshToken: string;
  }) => void;
  /** Só troca os tokens (usado após um refresh bem-sucedido) -- mantém user/org/role em cache. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Atualiza campos do usuário em cache após edição de perfil. */
  patchUser: (patch: Partial<PublicUser>) => void;
  /** Atualiza campos da organização em cache após edição em settings. */
  patchOrganization: (patch: Partial<OrganizationRef>) => void;
  clear: () => void;
  hasPermission: (permission: PermissionKey) => boolean;
}

/**
 * Tokens Bearer guardados em localStorage (via persist) -- a API não seta
 * cookie nenhum, então essa é a opção pragmática pra uma SPA consumindo
 * uma REST API separada. Risco conhecido: XSS teria acesso ao token.
 * Mitigação futura (fora do escopo desta fase): proxy no backend do
 * Next.js que troca o token por um cookie httpOnly.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      role: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, organization, role, accessToken, refreshToken }) =>
        set({ user, organization, role, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      patchUser: (patch) => {
        const user = get().user;
        if (user) set({ user: { ...user, ...patch } });
      },
      patchOrganization: (patch) => {
        const organization = get().organization;
        if (organization) set({ organization: { ...organization, ...patch } });
      },
      clear: () =>
        set({ user: null, organization: null, role: null, accessToken: null, refreshToken: null }),
      hasPermission: (permission) => get().role?.permissions.includes(permission) ?? false,
    }),
    {
      name: "millead-auth",
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        role: state.role,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);

export function isAuthenticated(): boolean {
  return useAuthStore.getState().accessToken !== null;
}
