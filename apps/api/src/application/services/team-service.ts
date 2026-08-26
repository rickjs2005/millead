import { type PermissionKey } from "@millead/database/permissions";
import {
  ConflictError,
  ForbiddenError,
  GoneError,
  NotFoundError,
  ValidationError,
} from "../../domain/errors/app-error.js";
import type { RoleRepository } from "../../domain/repositories/role-repository.js";
import type { TeamRepository } from "../../domain/repositories/team-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import type { PasswordHasher } from "../../domain/services/password-hasher.js";
import type { TeamInvitationNotifier } from "../../domain/services/team-invitation-notifier.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../infrastructure/auth/refresh-token-generator.js";
import { env } from "../../config/env.js";
import type {
  AcceptTeamInvitationInput,
  CreateTeamRoleInput,
  InviteTeamMemberInput,
  UpdateTeamMemberInput,
  UpdateTeamRoleInput,
} from "../dto/team.dto.js";
import type { AuditLogger } from "./audit-logger.js";
import type { RequestMeta, SessionIssuer } from "./session-issuer.js";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface TeamActor {
  userId: string;
  permissions: PermissionKey[];
}

export class TeamService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly roles: RoleRepository,
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionIssuer: SessionIssuer,
    private readonly auditLogger: AuditLogger,
    private readonly notifier: TeamInvitationNotifier,
  ) {}

  directory(organizationId: string) {
    return this.teams.listAssignableMembers(organizationId);
  }

  listMembers(organizationId: string) {
    return this.teams.listMembers(organizationId);
  }

  listInvitations(organizationId: string) {
    return this.teams.listInvitations(organizationId);
  }

  listRoles(organizationId: string) {
    return this.roles.listForOrganization(organizationId);
  }

  async invite(organizationId: string, actor: TeamActor, input: InviteTeamMemberInput) {
    const existing = await this.teams.findMemberByEmail(organizationId, input.email);
    if (existing) {
      throw new ConflictError(
        existing.status === "SUSPENDED"
          ? "Este usuário já pertence à equipe e pode ser reativado."
          : "Este usuário já pertence à equipe.",
      );
    }

    const role = await this.requireRole(organizationId, input.roleId);
    this.assertCanGrant(actor.permissions, role.permissions);

    const rawToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await this.teams.upsertInvitation({
      organizationId,
      email: input.email,
      roleId: role.id,
      invitedById: actor.userId,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });
    const inviteUrl = `${env.WEB_PUBLIC_URL.replace(/\/$/, "")}/invite/${rawToken}`;
    const inviter = await this.users.findById(actor.userId);
    const emailSent = await this.notifier.send({
      to: input.email,
      organizationName: invitation.organization.name,
      inviterName: inviter?.name ?? "Um administrador",
      roleName: role.name,
      inviteUrl,
      expiresAt,
    });
    return { invitation, inviteUrl, emailSent };
  }

  async revokeInvitation(organizationId: string, invitationId: string) {
    const revoked = await this.teams.revokeInvitation(organizationId, invitationId, new Date());
    if (!revoked) throw new NotFoundError("Convite pendente não encontrado.");
  }

  async previewInvitation(token: string) {
    const invitation = await this.requireValidInvitation(token);
    const existingUser = await this.users.findByEmail(invitation.email);
    if (existingUser && !existingUser.isActive) {
      throw new ForbiddenError("Esta conta está desativada. Fale com o administrador.");
    }
    return {
      email: invitation.email,
      organization: invitation.organization,
      role: { id: invitation.role.id, name: invitation.role.name },
      expiresAt: invitation.expiresAt,
      existingAccount: Boolean(existingUser),
    };
  }

  async acceptInvitation(input: AcceptTeamInvitationInput, meta: RequestMeta) {
    const invitation = await this.requireValidInvitation(input.token);
    const existingUser = await this.users.findByEmail(invitation.email);
    if (existingUser && !existingUser.isActive) {
      throw new ForbiddenError("Esta conta está desativada. Fale com o administrador.");
    }

    let newUser: { name: string; passwordHash: string } | undefined;
    if (!existingUser) {
      if (!input.name || !input.password) {
        throw new ValidationError("Informe nome e senha para criar sua conta.");
      }
      newUser = {
        name: input.name,
        passwordHash: await this.passwordHasher.hash(input.password),
      };
    }

    let accepted;
    try {
      accepted = await this.teams.acceptInvitation({
        invitationId: invitation.id,
        now: new Date(),
        newUser,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "TEAM_INVITATION_ALREADY_CLAIMED") {
        throw new GoneError("Este convite já foi usado ou não está mais disponível.");
      }
      throw error;
    }

    await this.auditLogger.log(
      { organizationId: invitation.organizationId, userId: accepted.user.id, ...meta },
      "team.invitation.accepted",
      { entityType: "Membership", entityId: accepted.membership.id },
    );
    return this.sessionIssuer.issue(accepted.user, accepted.membership, meta);
  }

  async updateMember(
    organizationId: string,
    actor: TeamActor,
    membershipId: string,
    patch: UpdateTeamMemberInput,
  ) {
    const member = await this.teams.findMemberById(organizationId, membershipId);
    if (!member) throw new NotFoundError("Membro não encontrado.");
    if (member.userId === actor.userId) {
      throw new ValidationError("Você não pode alterar o próprio papel ou status.");
    }
    this.assertCanGrant(actor.permissions, member.role.permissions);

    let nextRole = member.role;
    if (patch.roleId && patch.roleId !== member.role.id) {
      nextRole = await this.requireRole(organizationId, patch.roleId);
      this.assertCanGrant(actor.permissions, nextRole.permissions);
    }

    const removesActiveOwner =
      member.role.name === "Owner" &&
      member.status === "ACTIVE" &&
      (patch.status === "SUSPENDED" || nextRole.name !== "Owner");
    if (removesActiveOwner) {
      const owners = await this.teams.countActiveMembersByRole(organizationId, member.role.id);
      if (owners <= 1)
        throw new ConflictError("A organização precisa manter ao menos um Owner ativo.");
    }

    const updated = await this.teams.updateMember(organizationId, membershipId, patch);
    if (!updated) throw new NotFoundError("Membro não encontrado.");
    return updated;
  }

  async createRole(organizationId: string, actor: TeamActor, input: CreateTeamRoleInput) {
    this.assertCanGrant(actor.permissions, input.permissions);
    return this.roles.create({ organizationId, ...input });
  }

  async updateRole(
    organizationId: string,
    actor: TeamActor,
    roleId: string,
    patch: UpdateTeamRoleInput,
  ) {
    const role = await this.requireRole(organizationId, roleId);
    if (role.isSystem) throw new ValidationError("Papéis padrão não podem ser alterados.");
    this.assertCanGrant(actor.permissions, role.permissions);
    if (patch.permissions) this.assertCanGrant(actor.permissions, patch.permissions);
    const updated = await this.roles.update(roleId, organizationId, patch);
    if (!updated) throw new NotFoundError("Papel não encontrado.");
    return updated;
  }

  async deleteRole(organizationId: string, actor: TeamActor, roleId: string) {
    const role = await this.requireRole(organizationId, roleId);
    if (role.isSystem) throw new ValidationError("Papéis padrão não podem ser excluídos.");
    this.assertCanGrant(actor.permissions, role.permissions);
    const members = await this.roles.countMemberships(roleId, organizationId);
    if (members > 0) {
      throw new ConflictError(
        "Reatribua os membros ou revogue os convites deste papel antes de excluí-lo.",
      );
    }
    const deleted = await this.roles.delete(roleId, organizationId);
    if (!deleted) throw new NotFoundError("Papel não encontrado.");
  }

  private async requireRole(organizationId: string, roleId: string) {
    const role = await this.roles.findByIdForOrganization(roleId, organizationId);
    if (!role) throw new NotFoundError("Papel não encontrado.");
    return role;
  }

  private assertCanGrant(actorPermissions: PermissionKey[], targetPermissions: PermissionKey[]) {
    const missing = targetPermissions.find((permission) => !actorPermissions.includes(permission));
    if (missing) {
      throw new ForbiddenError(
        "Você não pode conceder um papel com permissões superiores às suas.",
      );
    }
  }

  private async requireValidInvitation(token: string) {
    const invitation = await this.teams.findInvitationByTokenHash(hashToken(token));
    if (!invitation) throw new NotFoundError("Convite não encontrado.");
    if (invitation.acceptedAt) throw new GoneError("Este convite já foi aceito.");
    if (invitation.revokedAt) throw new GoneError("Este convite foi revogado.");
    if (invitation.expiresAt.getTime() <= Date.now()) throw new GoneError("Este convite expirou.");
    return invitation;
  }
}
