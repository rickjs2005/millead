import { prisma, Prisma } from "@millead/database";
import type { PermissionKey } from "@millead/database/permissions";
import type { MembershipContext } from "../../domain/entities/membership.js";
import type { Role } from "../../domain/entities/role.js";
import type { TeamInvitation, TeamMember } from "../../domain/entities/team.js";
import type { User } from "../../domain/entities/user.js";
import type {
  AcceptTeamInvitationInput,
  TeamRepository,
  UpsertTeamInvitationInput,
} from "../../domain/repositories/team-repository.js";

const roleWithPermissions = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

const memberInclude = {
  user: true,
  role: { include: roleWithPermissions },
} satisfies Prisma.MembershipInclude;

const invitationInclude = {
  role: { include: roleWithPermissions },
  organization: true,
} satisfies Prisma.TeamInvitationInclude;

type MemberRow = Prisma.MembershipGetPayload<{ include: typeof memberInclude }>;
type InvitationRow = Prisma.TeamInvitationGetPayload<{ include: typeof invitationInclude }>;

function toRole(row: MemberRow["role"] | InvitationRow["role"]): Role {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions.map((entry) => entry.permission.key as PermissionKey),
  };
}

function toMember(row: MemberRow): TeamMember {
  return {
    membershipId: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    avatarUrl: row.user.avatarUrl,
    userIsActive: row.user.isActive,
    lastLoginAt: row.user.lastLoginAt,
    status: row.status,
    invitedAt: row.invitedAt,
    joinedAt: row.joinedAt,
    createdAt: row.createdAt,
    role: toRole(row.role),
  };
}

function toInvitation(row: InvitationRow): TeamInvitation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    email: row.email,
    role: toRole(row.role),
    organization: {
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
    },
    invitedById: row.invitedById,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaTeamRepository implements TeamRepository {
  async listMembers(organizationId: string): Promise<TeamMember[]> {
    const rows = await prisma.membership.findMany({
      where: { organizationId },
      include: memberInclude,
      orderBy: [{ status: "asc" }, { user: { name: "asc" } }],
    });
    return rows.map(toMember);
  }

  async listAssignableMembers(organizationId: string): Promise<TeamMember[]> {
    const rows = await prisma.membership.findMany({
      where: { organizationId, status: "ACTIVE", user: { isActive: true } },
      include: memberInclude,
      orderBy: { user: { name: "asc" } },
    });
    return rows.map(toMember);
  }

  async findMemberById(organizationId: string, membershipId: string): Promise<TeamMember | null> {
    const row = await prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: memberInclude,
    });
    return row ? toMember(row) : null;
  }

  async findMemberByEmail(organizationId: string, email: string): Promise<TeamMember | null> {
    const row = await prisma.membership.findFirst({
      where: { organizationId, user: { email } },
      include: memberInclude,
    });
    return row ? toMember(row) : null;
  }

  async updateMember(
    organizationId: string,
    membershipId: string,
    patch: { roleId?: string; status?: "ACTIVE" | "SUSPENDED" },
  ): Promise<TeamMember | null> {
    const result = await prisma.membership.updateMany({
      where: { id: membershipId, organizationId },
      data: {
        ...(patch.roleId ? { roleId: patch.roleId } : {}),
        ...(patch.status ? { status: patch.status } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findMemberById(organizationId, membershipId);
  }

  countActiveMembersByRole(organizationId: string, roleId: string): Promise<number> {
    return prisma.membership.count({ where: { organizationId, roleId, status: "ACTIVE" } });
  }

  async listInvitations(organizationId: string): Promise<TeamInvitation[]> {
    const rows = await prisma.teamInvitation.findMany({
      where: { organizationId, acceptedAt: null, revokedAt: null },
      include: invitationInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toInvitation);
  }

  async findInvitationById(
    organizationId: string,
    invitationId: string,
  ): Promise<TeamInvitation | null> {
    const row = await prisma.teamInvitation.findFirst({
      where: { id: invitationId, organizationId },
      include: invitationInclude,
    });
    return row ? toInvitation(row) : null;
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<TeamInvitation | null> {
    const row = await prisma.teamInvitation.findUnique({
      where: { tokenHash },
      include: invitationInclude,
    });
    return row ? toInvitation(row) : null;
  }

  async upsertInvitation(input: UpsertTeamInvitationInput): Promise<TeamInvitation> {
    const row = await prisma.teamInvitation.upsert({
      where: {
        organizationId_email: {
          organizationId: input.organizationId,
          email: input.email,
        },
      },
      update: {
        roleId: input.roleId,
        invitedById: input.invitedById,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        acceptedAt: null,
        revokedAt: null,
      },
      create: input,
      include: invitationInclude,
    });
    return toInvitation(row);
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const result = await prisma.teamInvitation.updateMany({
      where: { id: invitationId, organizationId, acceptedAt: null, revokedAt: null },
      data: { revokedAt },
    });
    return result.count > 0;
  }

  async acceptInvitation(
    input: AcceptTeamInvitationInput,
  ): Promise<{ user: User; membership: MembershipContext }> {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.teamInvitation.updateMany({
        where: {
          id: input.invitationId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: input.now },
        },
        data: { acceptedAt: input.now },
      });
      if (claimed.count === 0) throw new Error("TEAM_INVITATION_ALREADY_CLAIMED");

      const invitation = await tx.teamInvitation.findUniqueOrThrow({
        where: { id: input.invitationId },
      });
      let user = await tx.user.findUnique({ where: { email: invitation.email } });
      if (!user) {
        if (!input.newUser) throw new Error("TEAM_INVITATION_USER_DATA_REQUIRED");
        user = await tx.user.create({
          data: {
            email: invitation.email,
            name: input.newUser.name,
            passwordHash: input.newUser.passwordHash,
          },
        });
      }

      const row = await tx.membership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        },
        update: {
          roleId: invitation.roleId,
          status: "ACTIVE",
          invitedAt: invitation.createdAt,
          joinedAt: input.now,
        },
        create: {
          userId: user.id,
          organizationId: invitation.organizationId,
          roleId: invitation.roleId,
          status: "ACTIVE",
          invitedAt: invitation.createdAt,
          joinedAt: input.now,
        },
        include: {
          organization: true,
          role: { include: { permissions: { include: { permission: true } } } },
          user: { select: { isActive: true } },
        },
      });

      return {
        user,
        membership: {
          id: row.id,
          userId: row.userId,
          organizationId: row.organizationId,
          organizationName: row.organization.name,
          organizationSlug: row.organization.slug,
          roleId: row.roleId,
          roleName: row.role.name,
          status: row.status,
          permissions: row.role.permissions.map((entry) => entry.permission.key as PermissionKey),
          userIsActive: row.user.isActive,
        },
      };
    });
  }
}
