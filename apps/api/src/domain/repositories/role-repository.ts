import type { Role } from "../entities/role.js";

export interface RoleRepository {
  /** Cria os papéis padrão (Owner/Admin/Sales/Viewer) pra uma organização nova. */
  provisionDefaultRoles(organizationId: string): Promise<Role[]>;
  findByOrganizationAndName(organizationId: string, name: string): Promise<Role | null>;
  findById(id: string): Promise<Role | null>;
}
