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
  /** Valida responsável sem permitir atribuição cruzada entre tenants --
   *  usado por leads/tarefas e pelo `defaultOwnerId` da automação
   *  pós-fechamento. Listar os membros é responsabilidade do módulo de
   *  equipe (`GET /api/v1/team/directory`), não deste repositório. */
  isActiveMember(userId: string, organizationId: string): Promise<boolean>;
}
