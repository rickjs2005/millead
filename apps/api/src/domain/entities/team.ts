import type { MembershipStatus } from "./membership.js";
import type { Role } from "./role.js";

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  userIsActive: boolean;
  lastLoginAt: Date | null;
  status: MembershipStatus;
  invitedAt: Date | null;
  joinedAt: Date | null;
  createdAt: Date;
  role: Role;
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: Role;
  organization: { id: string; name: string; slug: string };
  invitedById: string | null;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamInvitationPreview {
  email: string;
  organization: { id: string; name: string; slug: string };
  role: { id: string; name: string };
  expiresAt: Date;
  existingAccount: boolean;
}
