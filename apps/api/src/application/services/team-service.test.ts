import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS, type PermissionKey } from "@millead/database/permissions";
import { ConflictError, ForbiddenError, ValidationError } from "../../domain/errors/app-error.js";
import type { Role } from "../../domain/entities/role.js";
import type { TeamInvitation, TeamMember } from "../../domain/entities/team.js";
import type { RoleRepository } from "../../domain/repositories/role-repository.js";
import type { TeamRepository } from "../../domain/repositories/team-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import type { PasswordHasher } from "../../domain/services/password-hasher.js";
import type { TeamInvitationNotifier } from "../../domain/services/team-invitation-notifier.js";
import type { AuditLogger } from "./audit-logger.js";
import type { SessionIssuer } from "./session-issuer.js";
import { TeamService } from "./team-service.js";

const ORG = "org-1";
const ownerRole: Role = {
  id: "role-owner",
  organizationId: ORG,
  name: "Owner",
  description: null,
  isSystem: true,
  permissions: [PERMISSIONS.MEMBERS_MANAGE, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.BILLING_MANAGE],
};
const salesRole: Role = {
  id: "role-sales",
  organizationId: ORG,
  name: "Sales",
  description: null,
  isSystem: true,
  permissions: [PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_WRITE],
};

function member(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    membershipId: "membership-1",
    userId: "user-2",
    name: "Pessoa",
    email: "pessoa@milweb.com.br",
    avatarUrl: null,
    userIsActive: true,
    lastLoginAt: null,
    status: "ACTIVE",
    invitedAt: null,
    joinedAt: new Date(),
    createdAt: new Date(),
    role: salesRole,
    ...overrides,
  };
}

function invitation(overrides: Partial<TeamInvitation> = {}): TeamInvitation {
  return {
    id: "invite-1",
    organizationId: ORG,
    email: "nova@milweb.com.br",
    role: salesRole,
    organization: { id: ORG, name: "MilWeb", slug: "milweb" },
    invitedById: "user-owner",
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function fakeTeams(overrides: Partial<TeamRepository> = {}): TeamRepository {
  return {
    listMembers: vi.fn().mockResolvedValue([]),
    listAssignableMembers: vi.fn().mockResolvedValue([]),
    findMemberById: vi.fn().mockResolvedValue(null),
    findMemberByEmail: vi.fn().mockResolvedValue(null),
    updateMember: vi.fn().mockResolvedValue(null),
    countActiveMembersByRole: vi.fn().mockResolvedValue(1),
    listInvitations: vi.fn().mockResolvedValue([]),
    findInvitationById: vi.fn().mockResolvedValue(null),
    findInvitationByTokenHash: vi.fn().mockResolvedValue(null),
    upsertInvitation: vi.fn().mockResolvedValue(invitation()),
    revokeInvitation: vi.fn().mockResolvedValue(false),
    acceptInvitation: vi.fn(),
    ...overrides,
  } as unknown as TeamRepository;
}

function fakeRoles(overrides: Partial<RoleRepository> = {}): RoleRepository {
  return {
    provisionDefaultRoles: vi.fn(),
    findByOrganizationAndName: vi.fn(),
    findById: vi.fn(),
    findByIdForOrganization: vi.fn().mockResolvedValue(salesRole),
    listForOrganization: vi.fn().mockResolvedValue([ownerRole, salesRole]),
    create: vi.fn(),
    update: vi.fn(),
    countMemberships: vi.fn().mockResolvedValue(0),
    delete: vi.fn(),
    ...overrides,
  } as unknown as RoleRepository;
}

function makeService(
  options: {
    teams?: TeamRepository;
    roles?: RoleRepository;
    userByEmail?: object | null;
  } = {},
) {
  const users = {
    findByEmail: vi.fn().mockResolvedValue(options.userByEmail ?? null),
    findById: vi.fn().mockResolvedValue({ id: "user-owner", name: "Rick" }),
  } as unknown as UserRepository;
  const passwordHasher = { hash: vi.fn().mockResolvedValue("hash") } as unknown as PasswordHasher;
  const sessionIssuer = { issue: vi.fn() } as unknown as SessionIssuer;
  const auditLogger = { log: vi.fn() } as unknown as AuditLogger;
  const notifier = { send: vi.fn().mockResolvedValue(true) } as TeamInvitationNotifier;
  return {
    notifier,
    service: new TeamService(
      options.teams ?? fakeTeams(),
      options.roles ?? fakeRoles(),
      users,
      passwordHasher,
      sessionIssuer,
      auditLogger,
      notifier,
    ),
  };
}

describe("TeamService", () => {
  it("impede administrador de conceder permissões que ele próprio não possui", async () => {
    const { service, notifier } = makeService({
      roles: fakeRoles({ findByIdForOrganization: vi.fn().mockResolvedValue(ownerRole) }),
    });
    const adminPermissions: PermissionKey[] = [
      PERMISSIONS.MEMBERS_MANAGE,
      PERMISSIONS.ROLES_MANAGE,
    ];

    await expect(
      service.invite(
        ORG,
        { userId: "user-admin", permissions: adminPermissions },
        { email: "nova@milweb.com.br", roleId: ownerRole.id },
      ),
    ).rejects.toThrow(ForbiddenError);
    expect(notifier.send).not.toHaveBeenCalled();
  });

  it("cria convite seguro e dispara o notificador quando o papel é permitido", async () => {
    const teams = fakeTeams();
    const { service, notifier } = makeService({ teams });

    const result = await service.invite(
      ORG,
      { userId: "user-owner", permissions: [...ownerRole.permissions, ...salesRole.permissions] },
      { email: "nova@milweb.com.br", roleId: salesRole.id },
    );

    expect(teams.upsertInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORG,
        email: "nova@milweb.com.br",
        roleId: salesRole.id,
      }),
    );
    expect(notifier.send).toHaveBeenCalledOnce();
    expect(result.inviteUrl).toContain("/invite/");
  });

  it("não permite alterar o próprio papel ou status", async () => {
    const teams = fakeTeams({
      findMemberById: vi.fn().mockResolvedValue(member({ userId: "user-owner" })),
    });
    const { service } = makeService({ teams });

    await expect(
      service.updateMember(
        ORG,
        { userId: "user-owner", permissions: [...ownerRole.permissions, ...salesRole.permissions] },
        "membership-1",
        { status: "SUSPENDED" },
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("protege o último Owner ativo contra suspensão", async () => {
    const teams = fakeTeams({
      findMemberById: vi.fn().mockResolvedValue(member({ role: ownerRole })),
      countActiveMembersByRole: vi.fn().mockResolvedValue(1),
    });
    const { service } = makeService({ teams });

    await expect(
      service.updateMember(
        ORG,
        { userId: "outro-owner", permissions: ownerRole.permissions },
        "membership-1",
        { status: "SUSPENDED" },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("exige nome e senha ao aceitar convite de um e-mail sem conta", async () => {
    const teams = fakeTeams({ findInvitationByTokenHash: vi.fn().mockResolvedValue(invitation()) });
    const { service } = makeService({ teams, userByEmail: null });

    await expect(
      service.acceptInvitation(
        { token: "token-com-mais-de-trinta-e-dois-caracteres" },
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toThrow(ValidationError);
    expect(teams.acceptInvitation).not.toHaveBeenCalled();
  });
});
