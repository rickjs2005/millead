import type { Membership, MembershipContext, MembershipStatus } from "../entities/membership.js";

export interface CreateMembershipInput {
  userId: string;
  organizationId: string;
  roleId: string;
  status: MembershipStatus;
  joinedAt?: Date;
}

/** Membro da organização para telas de escolha de responsável -- só o
 *  público (nome, e-mail, papel), nunca hash de senha ou dado de sessão. */
export interface OrganizationMember {
  userId: string;
  name: string;
  email: string;
  roleName: string;
  status: MembershipStatus;
}

export interface MembershipRepository {
  create(input: CreateMembershipInput): Promise<Membership>;
  /** Membros ATIVOS da organização, ordenados por nome. */
  listMembersForOrg(organizationId: string): Promise<OrganizationMember[]>;
  /** true se o usuário tem vínculo ATIVO com a organização -- usado antes de
   *  gravar um `defaultOwnerId` (impede apontar pra usuário de outro tenant). */
  isActiveMember(userId: string, organizationId: string): Promise<boolean>;
  /** Contexto (papel + permissões resolvidos) de um usuário numa organização específica. */
  findContext(userId: string, organizationId: string): Promise<MembershipContext | null>;
  /** Todas as organizações que o usuário pode acessar -- usado no login pra listar workspaces. */
  listContextsForUser(userId: string): Promise<MembershipContext[]>;
}
