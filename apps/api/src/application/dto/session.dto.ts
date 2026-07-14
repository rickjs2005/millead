import type { PermissionKey } from "@millead/database/permissions";
import type { PublicUser } from "../../domain/entities/user.js";

export interface SessionResult {
  user: PublicUser;
  organization: { id: string; name: string; slug: string };
  role: { id: string; name: string; permissions: PermissionKey[] };
  accessToken: string;
  refreshToken: string;
}

/** Devolvido no login quando o usuário pertence a mais de uma organização e não escolheu uma. */
export interface OrganizationChoiceRequired {
  requiresOrganizationSelection: true;
  organizations: { id: string; name: string; slug: string; roleName: string }[];
}
