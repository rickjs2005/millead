import { prisma, Prisma } from "@millead/database";
import type { PermissionKey } from "@millead/database/permissions";
import type { Membership, MembershipContext } from "../../domain/entities/membership.js";
import type {
  CreateMembershipInput,
  MembershipRepository,
} from "../../domain/repositories/membership-repository.js";

const withContext = {
  organization: true,
  role: { include: { permissions: { include: { permission: true } } } },
} satisfies Prisma.MembershipInclude;

type MembershipRow = Prisma.MembershipGetPayload<{ include: typeof withContext }>;

function toContext(row: MembershipRow): MembershipContext {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    roleId: row.roleId,
    roleName: row.role.name,
    status: row.status,
    permissions: row.role.permissions.map((p) => p.permission.key as PermissionKey),
  };
}

export class PrismaMembershipRepository implements MembershipRepository {
  async create(input: CreateMembershipInput): Promise<Membership> {
    return prisma.membership.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        roleId: input.roleId,
        status: input.status,
        joinedAt: input.joinedAt,
      },
    });
  }

  async findContext(userId: string, organizationId: string): Promise<MembershipContext | null> {
    const row = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: withContext,
    });
    return row ? toContext(row) : null;
  }

  async listContextsForUser(userId: string): Promise<MembershipContext[]> {
    const rows = await prisma.membership.findMany({
      where: { userId, status: "ACTIVE" },
      include: withContext,
    });
    return rows.map(toContext);
  }
}
