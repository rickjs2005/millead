import { UnauthorizedError, ValidationError } from "../../../domain/errors/app-error.js";
import type { RefreshTokenRepository } from "../../../domain/repositories/refresh-token-repository.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";
import type { PasswordHasher } from "../../../domain/services/password-hasher.js";
import type { VaultLocker } from "../../../domain/services/vault-locker.js";
import type { ChangePasswordInput } from "../../dto/auth.dto.js";
import type { AuditLogger } from "../../services/audit-logger.js";
import type { RequestMeta } from "../../services/session-issuer.js";

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly auditLogger: AuditLogger,
    private readonly vaultLocker: VaultLocker,
  ) {}

  async execute(
    userId: string,
    organizationId: string,
    input: ChangePasswordInput,
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    // O usuário está autenticado, então isto não deveria acontecer -- mas se
    // a conta sumiu entre a emissão do token e agora, trate como sessão inválida.
    if (!user) {
      throw new UnauthorizedError("Sessão inválida.");
    }

    const currentMatches = await this.passwordHasher.compare(
      input.currentPassword,
      user.passwordHash,
    );
    // 422 (não 401) de propósito: "senha atual errada" é falha de validação do
    // campo, não sessão expirada -- se fosse 401, o api-client do front trataria
    // como logout e tentaria refresh no lugar de mostrar o erro no formulário.
    if (!currentMatches) {
      throw new ValidationError("Senha atual incorreta.");
    }

    const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.updatePassword(userId, newPasswordHash);

    // Invalida TODAS as sessões (inclusive a atual): se a senha foi trocada por
    // suspeita de comprometimento, qualquer refresh token roubado morre junto.
    // O access token atual (stateless) ainda vale ≤15min; no próximo refresh o
    // client é deslogado. O front força o re-login após sucesso.
    await this.refreshTokenRepository.revokeAllForUser(userId);
    // O Cofre reautentica com a senha DA CONTA, então trocar a senha tem que
    // fechar as sessões elevadas junto -- senão a senha antiga, já
    // comprometida, teria deixado um Cofre aberto que a troca não alcança.
    await this.vaultLocker.lockOnLogout(userId);

    await this.auditLogger.log({ organizationId, userId, ...meta }, "auth.password_changed", {
      entityType: "User",
      entityId: userId,
    });
  }
}
