import type { PermissionKey } from "@millead/database/permissions";

export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  status: MembershipStatus;
}

/**
 * O vínculo de um usuário com UMA organização, já com o papel e as
 * permissões resolvidas -- é isso que vira `req.auth` depois do
 * middleware de autenticação, e é a base de todo o RBAC.
 */
export interface MembershipContext extends Membership {
  organizationName: string;
  organizationSlug: string;
  roleName: string;
  permissions: PermissionKey[];
  /** `isActive` do usuário (conta global) -- separado do `status` do vínculo
   *  com a org. O `authenticate` rejeita conta desativada a cada request. */
  userIsActive: boolean;
}
