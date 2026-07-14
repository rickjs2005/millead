import { ForbiddenError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import type { MembershipRepository } from "../../../domain/repositories/membership-repository.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";
import type { PasswordHasher } from "../../../domain/services/password-hasher.js";
import type { LoginInput } from "../../dto/auth.dto.js";
import type { OrganizationChoiceRequired, SessionResult } from "../../dto/session.dto.js";
import type { AuditLogger } from "../../services/audit-logger.js";
import type { RequestMeta, SessionIssuer } from "../../services/session-issuer.js";

const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha inválidos.";

export class LoginUseCase {
  /** Hash bcrypt válido que nenhuma senha real bate -- comparado contra ele
   *  quando o e-mail não existe, pra gastar o mesmo tempo de CPU de um
   *  bcrypt.compare de verdade. Sem isso, a resposta de "usuário não
   *  encontrado" é bem mais rápida que a de "senha errada", e essa
   *  diferença de latência é o bastante pra um atacante enumerar quais
   *  e-mails estão cadastrados, mesmo com a mensagem de erro genérica. */
  private static dummyHashPromise: Promise<string> | null = null;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionIssuer: SessionIssuer,
    private readonly auditLogger: AuditLogger,
  ) {}

  async execute(
    input: LoginInput,
    meta: RequestMeta,
  ): Promise<SessionResult | OrganizationChoiceRequired> {
    const user = await this.userRepository.findByEmail(input.email);
    // Mensagem genérica de propósito: não revelar se foi o e-mail ou a senha que errou.
    if (!user || !user.isActive) {
      await this.passwordHasher.compare(input.password, await this.getDummyHash());
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }
    const passwordMatches = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS_MESSAGE);
    }

    const contexts = await this.membershipRepository.listContextsForUser(user.id);
    if (contexts.length === 0) {
      throw new ForbiddenError("Este usuário não pertence a nenhuma organização ativa.");
    }

    let context = contexts[0]!;
    if (input.organizationSlug) {
      const match = contexts.find((c) => c.organizationSlug === input.organizationSlug);
      if (!match) {
        throw new ForbiddenError("Usuário sem acesso a esta organização.");
      }
      context = match;
    } else if (contexts.length > 1) {
      return {
        requiresOrganizationSelection: true,
        organizations: contexts.map((c) => ({
          id: c.organizationId,
          name: c.organizationName,
          slug: c.organizationSlug,
          roleName: c.roleName,
        })),
      };
    }

    await this.userRepository.touchLastLogin(user.id);
    await this.auditLogger.log(
      { organizationId: context.organizationId, userId: user.id, ...meta },
      "auth.login",
      { entityType: "User", entityId: user.id },
    );

    return this.sessionIssuer.issue(user, context, meta);
  }

  private getDummyHash(): Promise<string> {
    LoginUseCase.dummyHashPromise ??= this.passwordHasher.hash(
      "timing-attack-mitigation-dummy-password",
    );
    return LoginUseCase.dummyHashPromise;
  }
}
