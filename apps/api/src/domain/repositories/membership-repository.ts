import type { Membership, MembershipContext, MembershipStatus } from "../entities/membership.js";

export interface CreateMembershipInput {
  userId: string;
  organizationId: string;
  roleId: string;
  status: MembershipStatus;
  joinedAt?: Date;
}

export interface MembershipRepository {
  create(input: CreateMembershipInput): Promise<Membership>;
  /** Contexto (papel + permissões resolvidos) de um usuário numa organização específica. */
  findContext(userId: string, organizationId: string): Promise<MembershipContext | null>;
  /** Todas as organizações que o usuário pode acessar -- usado no login pra listar workspaces. */
  listContextsForUser(userId: string): Promise<MembershipContext[]>;
}
