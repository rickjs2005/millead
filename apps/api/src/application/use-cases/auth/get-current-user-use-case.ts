import { ForbiddenError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import type { MembershipRepository } from "../../../domain/repositories/membership-repository.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";
import { toPublicUser } from "../../../domain/entities/user.js";
import type { SessionResult } from "../../dto/session.dto.js";

export type CurrentUserResult = Omit<SessionResult, "accessToken" | "refreshToken">;

export class GetCurrentUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
  ) {}

  async execute(userId: string, organizationId: string): Promise<CurrentUserResult> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Sessão inválida.");
    }
    const context = await this.membershipRepository.findContext(userId, organizationId);
    if (!context || context.status !== "ACTIVE") {
      throw new ForbiddenError("Acesso a esta organização foi revogado.");
    }
    return {
      user: toPublicUser(user),
      organization: {
        id: context.organizationId,
        name: context.organizationName,
        slug: context.organizationSlug,
      },
      role: { id: context.roleId, name: context.roleName, permissions: context.permissions },
    };
  }
}
