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

  async findByIdForOrganization(id: string, organizationId: string): Promise<Role | null> {
    const role = await prisma.role.findFirst({
      where: { id, organizationId },
      include: withPermissions,
    });
    return role ? toDomainRole(role) : null;
  }

  async listForOrganization(organizationId: string): Promise<Role[]> {
    const roles = await prisma.role.findMany({
      where: { organizationId },
      include: withPermissions,
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    return roles.map(toDomainRole);
  }

  async create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    permissions: PermissionKey[];
  }): Promise<Role> {
    const permissions = await prisma.permission.findMany({
      where: { key: { in: input.permissions } },
    });
    const role = await prisma.role.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
      },
      include: withPermissions,
    });
    return toDomainRole(role);
  }

  async update(
    id: string,
    organizationId: string,
    patch: { name?: string; description?: string | null; permissions?: PermissionKey[] },
  ): Promise<Role | null> {
    const existing = await prisma.role.findFirst({ where: { id, organizationId } });
    if (!existing) return null;

    const role = await prisma.$transaction(async (tx) => {
      if (patch.permissions) {
        const permissions = await tx.permission.findMany({
          where: { key: { in: patch.permissions } },
        });
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })),
          skipDuplicates: true,
        });
      }
      return tx.role.update({
        where: { id },
        data: {
          ...(patch.name ? { name: patch.name } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
        },
        include: withPermissions,
      });
    });
    return toDomainRole(role);
  }

  async countMemberships(id: string, organizationId: string): Promise<number> {
    const [members, invitations] = await Promise.all([
      prisma.membership.count({ where: { roleId: id, organizationId } }),
      prisma.teamInvitation.count({
        where: { roleId: id, organizationId, acceptedAt: null, revokedAt: null },
      }),
    ]);
    return members + invitations;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await prisma.role.deleteMany({ where: { id, organizationId } });
    return result.count > 0;
  }
}
