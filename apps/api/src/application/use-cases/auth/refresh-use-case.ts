import { UnauthorizedError, ForbiddenError } from "../../../domain/errors/app-error.js";
import type { MembershipRepository } from "../../../domain/repositories/membership-repository.js";
import type { RefreshTokenRepository } from "../../../domain/repositories/refresh-token-repository.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";
import { hashToken } from "../../../infrastructure/auth/refresh-token-generator.js";
import type { RefreshInput } from "../../dto/auth.dto.js";
import type { SessionResult } from "../../dto/session.dto.js";
import type { AuditLogger } from "../../services/audit-logger.js";
import type { RequestMeta, SessionIssuer } from "../../services/session-issuer.js";

const SESSION_INVALID_MESSAGE = "Sessão inválida, faça login novamente.";

export class RefreshUseCase {
  constructor(
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionIssuer: SessionIssuer,
    private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RefreshInput, meta: RequestMeta): Promise<SessionResult> {
    const tokenHash = hashToken(input.refreshToken);
    const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (!stored) {
      throw new UnauthorizedError(SESSION_INVALID_MESSAGE);
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError("Sessão expirada, faça login novamente.");
    }

    // Reivindicação atômica: só uma chamada concorrente consegue revogar
    // este token (ver comentário em PrismaRefreshTokenRepository.revoke).
    // `false` cobre TANTO reuso de um token já revogado (roubo de sessão)
    // QUANTO uma corrida perdida contra outra requisição simultânea com o
    // mesmo token -- em ambos os casos, a reação é a mesma: desconfiar de
    // toda a sessão e derrubar a família inteira de tokens do usuário.
    const claimed = await this.refreshTokenRepository.revoke(stored.id);
    if (!claimed) {
      await this.refreshTokenRepository.revokeAllForUser(stored.userId);
      await this.auditLogger.log(
        { organizationId: stored.organizationId, userId: stored.userId, ...meta },
        "auth.refresh_token_reuse_detected",
      );
      throw new UnauthorizedError(SESSION_INVALID_MESSAGE);
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError(SESSION_INVALID_MESSAGE);
    }

    if (!stored.organizationId) {
      throw new ForbiddenError("Sessão sem organização associada.");
    }
    const context = await this.membershipRepository.findContext(user.id, stored.organizationId);
    if (!context || context.status !== "ACTIVE") {
      throw new ForbiddenError("Acesso a esta organização foi revogado.");
    }

    const session = await this.sessionIssuer.issue(user, context, meta);

    // Amarra o token antigo (já revogado acima) ao novo -- a cadeia de
    // rotação em si não é usada por nenhuma decisão de segurança hoje
    // (isso já foi resolvido pela reivindicação atômica acima), mas fica
    // disponível pra investigação forense de uma sessão específica.
    const newTokenRow = await this.refreshTokenRepository.findByTokenHash(
      hashToken(session.refreshToken),
    );
    if (newTokenRow) {
      await this.refreshTokenRepository.setReplacedBy(stored.id, newTokenRow.id);
    }

    await this.auditLogger.log(
      { organizationId: context.organizationId, userId: user.id, ...meta },
      "auth.refresh",
    );

    return session;
  }
}
