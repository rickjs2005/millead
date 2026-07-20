import { env } from "../../config/env.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";

export type IntegrationStatusLevel = "connected" | "disabled" | "not_configured";

export interface IntegrationStatus {
  key: "email" | "whatsapp" | "signature" | "ai";
  name: string;
  status: IntegrationStatusLevel;
  /** O que o canal faz (texto pro card). */
  description: string;
  /** Detalhe NÃO-sensível (provedor, versão, modelo) -- nunca segredo. */
  detail: string | null;
}

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

  /**
   * Status das integrações da plataforma (nível de env, ainda não por org).
   * Devolve só booleans/labels públicos -- NUNCA host, usuário, token, chave
   * ou telefone. É seguro pra qualquer usuário autenticado ver.
   */
  getIntegrationsStatus(): { integrations: IntegrationStatus[] } {
    const whatsappConfigured = Boolean(env.WHATSAPP_PHONE_ID && env.WHATSAPP_TOKEN);
    const usesZapsign = env.SIGNATURE_PROVIDER === "zapsign";

    const integrations: IntegrationStatus[] = [
      {
        key: "email",
        name: "E-mail (SMTP)",
        status: env.SMTP_HOST ? "connected" : "not_configured",
        description: "E-mails transacionais: convite e confirmação de assinatura de contratos.",
        detail: null,
      },
      {
        key: "whatsapp",
        name: "WhatsApp",
        status: !env.WHATSAPP_ENABLED
          ? "disabled"
          : whatsappConfigured
            ? "connected"
            : "not_configured",
        description: "Notificações de contrato por WhatsApp (Meta Cloud API).",
        detail:
          env.WHATSAPP_ENABLED && whatsappConfigured
            ? `Meta Cloud API ${env.WHATSAPP_API_VERSION}`
            : null,
      },
      {
        key: "signature",
        name: "Assinatura eletrônica",
        status: usesZapsign
          ? env.ZAPSIGN_API_TOKEN
            ? "connected"
            : "not_configured"
          : "connected",
        description: "Assinatura eletrônica de contratos pelos clientes.",
        detail: usesZapsign ? "Provedor: ZapSign" : "Modo simulado (mock)",
      },
      {
        key: "ai",
        name: "Inteligência artificial",
        status: env.ANTHROPIC_API_KEY ? "connected" : "not_configured",
        description: "Score de leads, relatórios e geração de sites com IA.",
        detail: env.ANTHROPIC_API_KEY ? `Modelo: ${env.AI_MODEL}` : null,
      },
    ];

    return { integrations };
  }
}
