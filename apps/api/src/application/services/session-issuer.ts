import { env } from "../../config/env.js";
import type { MembershipContext } from "../../domain/entities/membership.js";
import { toPublicUser, type User } from "../../domain/entities/user.js";
import type { RefreshTokenRepository } from "../../domain/repositories/refresh-token-repository.js";
import type { AccessTokenService } from "../../domain/services/access-token-service.js";
import {
  durationFromNow,
  generateOpaqueToken,
  hashToken,
} from "../../infrastructure/auth/refresh-token-generator.js";
import type { SessionResult } from "../dto/session.dto.js";

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Emite o par access+refresh token pra uma sessão (usuário já autenticado
 * num tenant). Compartilhado por register/login/refresh pra não duplicar
 * essa lógica em cada use-case.
 */
export class SessionIssuer {
  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async issue(
    user: User,
    membership: MembershipContext,
    meta: RequestMeta,
  ): Promise<SessionResult> {
    const accessToken = this.accessTokenService.sign({
      sub: user.id,
      organizationId: membership.organizationId,
    });

    const rawRefreshToken = generateOpaqueToken();
    await this.refreshTokenRepository.create({
      userId: user.id,
      organizationId: membership.organizationId,
      tokenHash: hashToken(rawRefreshToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt: durationFromNow(env.JWT_REFRESH_TTL),
    });

    return {
      user: toPublicUser(user),
      organization: {
        id: membership.organizationId,
        name: membership.organizationName,
        slug: membership.organizationSlug,
      },
      role: {
        id: membership.roleId,
        name: membership.roleName,
        permissions: membership.permissions,
      },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }
}
