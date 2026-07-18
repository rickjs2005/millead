import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";

/**
 * Edições de Configurações (perfil e organização). E-mail e slug ficam de
 * fora de propósito: e-mail é identidade de login (trocar exige fluxo de
 * verificação) e slug é usado em URLs públicas (/fechamento/:slug).
 */
export class SettingsService {
  constructor(
    private readonly users: UserRepository,
    private readonly organizations: OrganizationRepository,
  ) {}

  async updateProfile(userId: string, input: { name: string }) {
    const user = await this.users.updateName(userId, input.name.trim());
    return { id: user.id, name: user.name, email: user.email };
  }

  async updateOrganization(organizationId: string, input: { name: string }) {
    const org = await this.organizations.updateName(organizationId, input.name.trim());
    return { id: org.id, name: org.name, slug: org.slug };
  }
}
