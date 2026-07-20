import { create } from "zustand";
import type { OrganizationRef, PermissionKey, PublicUser, RoleRef } from "@/types/api";

interface AuthState {
  user: PublicUser | null;
  organization: OrganizationRef | null;
  role: RoleRef | null;
  setSession: (session: { user: PublicUser; organization: OrganizationRef; role: RoleRef }) => void;
  /** Atualiza campos do usuário em cache após edição de perfil. */
  patchUser: (patch: Partial<PublicUser>) => void;
  /** Atualiza campos da organização em cache após edição em settings. */
  patchOrganization: (patch: Partial<OrganizationRef>) => void;
  clear: () => void;
  hasPermission: (permission: PermissionKey) => boolean;
}

/**
 * Store só de UI: guarda user/org/role pra render (nome, permissões, etc.).
 * Os tokens NÃO ficam aqui nem em localStorage -- vivem em cookies httpOnly
 * geridos pelo BFF, então um XSS não consegue roubar a sessão. Também não há
 * `persist`: a fonte de verdade da sessão é o cookie (checado server-side pelo
 * middleware), e estes dados são re-hidratados de `/auth/me` a cada carga
 * (ver ProtectedShell) -- assim papel/permissões nunca ficam desatualizados.
 */
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  organization: null,
  role: null,
  setSession: ({ user, organization, role }) => set({ user, organization, role }),
  patchUser: (patch) => {
    const user = get().user;
    if (user) set({ user: { ...user, ...patch } });
  },
  patchOrganization: (patch) => {
    const organization = get().organization;
    if (organization) set({ organization: { ...organization, ...patch } });
  },
  clear: () => set({ user: null, organization: null, role: null }),
  hasPermission: (permission) => get().role?.permissions.includes(permission) ?? false,
}));
