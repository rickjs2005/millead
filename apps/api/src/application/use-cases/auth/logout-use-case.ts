import type { RefreshTokenRepository } from "../../../domain/repositories/refresh-token-repository.js";
import { hashToken } from "../../../infrastructure/auth/refresh-token-generator.js";
import type { LogoutInput } from "../../dto/auth.dto.js";
import type { AuditLogger } from "../../services/audit-logger.js";
import type { RequestMeta } from "../../services/session-issuer.js";

export class LogoutUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  /** Idempotente de propósito: logout nunca falha por token já inválido/ausente. */
  async execute(input: LogoutInput, meta: RequestMeta): Promise<void> {
    const stored = await this.refreshTokenRepository.findByTokenHash(hashToken(input.refreshToken));
    if (!stored || stored.revokedAt) return;

    await this.refreshTokenRepository.revoke(stored.id);
    await this.auditLogger.log(
      { organizationId: stored.organizationId, userId: stored.userId, ...meta },
      "auth.logout",
    );
  }
}
