import { prisma } from "@millead/database";
import { SYSTEM_ROLES, type PermissionKey } from "@millead/database/permissions";
import type { Role } from "../../domain/entities/role.js";
import type { RoleRepository } from "../../domain/repositories/role-repository.js";

function toDomainRole(row: {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { key: string } }[];
}): Role {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions.map((p) => p.permission.key as PermissionKey),
  };
}

const withPermissions = {
  permissions: { include: { permission: true } },
} as const;

export class PrismaRoleRepository implements RoleRepository {
  async provisionDefaultRoles(organizationId: string): Promise<Role[]> {
    const roles: Role[] = [];
    for (const roleDef of SYSTEM_ROLES) {
      const permissions = await prisma.permission.findMany({
        where: { key: { in: [...roleDef.permissions] } },
      });
      const role = await prisma.role.create({
        data: {
          organizationId,
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          permissions: {
            create: permissions.map((p) => ({ permissionId: p.id })),
          },
        },
        include: withPermissions,
      });
      roles.push(toDomainRole(role));
    }
    return roles;
  }

  async findByOrganizationAndName(organizationId: string, name: string): Promise<Role | null> {
    const role = await prisma.role.findUnique({
      where: { organizationId_name: { organizationId, name } },
      include: withPermissions,
    });
    return role ? toDomainRole(role) : null;
  }

  async findById(id: string): Promise<Role | null> {
    const role = await prisma.role.findUnique({ where: { id }, include: withPermissions });
    return role ? toDomainRole(role) : null;
  }
}
