import { api } from "./api-client";
import type {
  CurrentUserResult,
  PermissionKey,
  TeamInvitation,
  TeamInvitationPreview,
  TeamMember,
  TeamRole,
} from "@/types/api";

export interface TeamRolePayload {
  name: string;
  description?: string | null;
  permissions: PermissionKey[];
}

export const teamService = {
  directory: () => api.get<TeamMember[]>("/api/v1/team/directory"),
  members: () => api.get<TeamMember[]>("/api/v1/team/members"),
  roles: () => api.get<TeamRole[]>("/api/v1/team/roles"),
  invitations: () => api.get<TeamInvitation[]>("/api/v1/team/invitations"),
  invite: (payload: { email: string; roleId: string }) =>
    api.post<{ invitation: TeamInvitation; inviteUrl: string; emailSent: boolean }>(
      "/api/v1/team/invitations",
      payload,
    ),
  revokeInvitation: (id: string) => api.delete<void>(`/api/v1/team/invitations/${id}`),
  updateMember: (id: string, patch: { roleId?: string; status?: "ACTIVE" | "SUSPENDED" }) =>
    api.patch<TeamMember>(`/api/v1/team/members/${id}`, patch),
  createRole: (payload: TeamRolePayload) => api.post<TeamRole>("/api/v1/team/roles", payload),
  updateRole: (id: string, patch: Partial<TeamRolePayload>) =>
    api.patch<TeamRole>(`/api/v1/team/roles/${id}`, patch),
  deleteRole: (id: string) => api.delete<void>(`/api/v1/team/roles/${id}`),
  previewInvitation: (token: string) =>
    api.post<TeamInvitationPreview>(
      "/api/v1/public/team-invitations/preview",
      { token },
      { skipAuth: true },
    ),
  acceptInvitation: (payload: { token: string; name?: string; password?: string }) =>
    api.post<CurrentUserResult>("/auth/accept-invitation", payload, { skipAuth: true }),
};
