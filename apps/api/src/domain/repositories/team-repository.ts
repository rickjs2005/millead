import type { MembershipContext, MembershipStatus } from "../entities/membership.js";
import type { TeamInvitation, TeamMember } from "../entities/team.js";
import type { User } from "../entities/user.js";

export interface UpsertTeamInvitationInput {
  organizationId: string;
  email: string;
  roleId: string;
  invitedById: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AcceptTeamInvitationInput {
  invitationId: string;
  now: Date;
  newUser?: { name: string; passwordHash: string };
}

export interface TeamRepository {
  listMembers(organizationId: string): Promise<TeamMember[]>;
  listAssignableMembers(organizationId: string): Promise<TeamMember[]>;
  findMemberById(organizationId: string, membershipId: string): Promise<TeamMember | null>;
  findMemberByEmail(organizationId: string, email: string): Promise<TeamMember | null>;
  updateMember(
    organizationId: string,
    membershipId: string,
    patch: { roleId?: string; status?: Extract<MembershipStatus, "ACTIVE" | "SUSPENDED"> },
  ): Promise<TeamMember | null>;
  countActiveMembersByRole(organizationId: string, roleId: string): Promise<number>;

  listInvitations(organizationId: string): Promise<TeamInvitation[]>;
  findInvitationById(organizationId: string, invitationId: string): Promise<TeamInvitation | null>;
  findInvitationByTokenHash(tokenHash: string): Promise<TeamInvitation | null>;
  upsertInvitation(input: UpsertTeamInvitationInput): Promise<TeamInvitation>;
  revokeInvitation(organizationId: string, invitationId: string, revokedAt: Date): Promise<boolean>;
  acceptInvitation(
    input: AcceptTeamInvitationInput,
  ): Promise<{ user: User; membership: MembershipContext }>;
}
