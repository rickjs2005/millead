import { ConflictError } from "../../../domain/errors/app-error.js";
import type { MembershipContext } from "../../../domain/entities/membership.js";
import type { MembershipRepository } from "../../../domain/repositories/membership-repository.js";
import type { OrganizationRepository } from "../../../domain/repositories/organization-repository.js";
import type { RoleRepository } from "../../../domain/repositories/role-repository.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";
import type { PasswordHasher } from "../../../domain/services/password-hasher.js";
import { slugify } from "../../../shared/slugify.js";
import type { RegisterInput } from "../../dto/auth.dto.js";
import type { SessionResult } from "../../dto/session.dto.js";
import type { AuditLogger } from "../../services/audit-logger.js";
import type { RequestMeta, SessionIssuer } from "../../services/session-issuer.js";

export class RegisterUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly roleRepository: RoleRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionIssuer: SessionIssuer,
    private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: RegisterInput, meta: RequestMeta): Promise<SessionResult> {
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictError("Já existe uma conta com este e-mail.");
    }

    const organizationSlug = await this.generateUniqueSlug(input.organizationName);
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.userRepository.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });
    const organization = await this.organizationRepository.create({
      name: input.organizationName,
      slug: organizationSlug,
    });

    const roles = await this.roleRepository.provisionDefaultRoles(organization.id);
    const ownerRole = roles.find((r) => r.name === "Owner");
    if (!ownerRole) {
      throw new Error("Falha ao provisionar papéis padrão: papel Owner não encontrado.");
    }

    const membership = await this.membershipRepository.create({
      userId: user.id,
      organizationId: organization.id,
      roleId: ownerRole.id,
      status: "ACTIVE",
      joinedAt: new Date(),
    });

    const context: MembershipContext = {
      ...membership,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      roleName: ownerRole.name,
      permissions: ownerRole.permissions,
      userIsActive: user.isActive,
    };

    await this.auditLogger.log(
      { organizationId: organization.id, userId: user.id, ...meta },
      "auth.register",
      { entityType: "User", entityId: user.id },
    );

    return this.sessionIssuer.issue(user, context, meta);
  }

  private async generateUniqueSlug(organizationName: string): Promise<string> {
    const base = slugify(organizationName) || "org";
    let candidate = base;
    let suffix = 1;
    while (await this.organizationRepository.findBySlug(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
