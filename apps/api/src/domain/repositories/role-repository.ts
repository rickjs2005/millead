import type { Role } from "../entities/role.js";
import type { PermissionKey } from "@millead/database/permissions";

export interface RoleRepository {
  /** Cria os papéis padrão (Owner/Admin/Sales/Viewer) pra uma organização nova. */
  provisionDefaultRoles(organizationId: string): Promise<Role[]>;
  findByOrganizationAndName(organizationId: string, name: string): Promise<Role | null>;
  findById(id: string): Promise<Role | null>;
  findByIdForOrganization(id: string, organizationId: string): Promise<Role | null>;
  listForOrganization(organizationId: string): Promise<Role[]>;
  create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    permissions: PermissionKey[];
  }): Promise<Role>;
  update(
    id: string,
    organizationId: string,
    patch: { name?: string; description?: string | null; permissions?: PermissionKey[] },
  ): Promise<Role | null>;
  countMemberships(id: string, organizationId: string): Promise<number>;
  delete(id: string, organizationId: string): Promise<boolean>;
}
