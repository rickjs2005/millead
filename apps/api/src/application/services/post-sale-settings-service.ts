import type { PostSaleAutomationSettings } from "../../domain/entities/post-sale-automation.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { BriefingTemplateRepository } from "../../domain/repositories/briefing-template-repository.js";
import type {
  MembershipRepository,
  OrganizationMember,
} from "../../domain/repositories/membership-repository.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";
import type { PostSaleAutomationRepository } from "../../domain/repositories/post-sale-automation-repository.js";
import type { UpdatePostSaleSettingsRequest } from "../dto/post-sale-automation.dto.js";

/** O que ainda falta configurar pra automação rodar inteira -- a tela mostra
 *  isso como aviso ANTES do contrato ser assinado, em vez de o dono descobrir
 *  pela pendência depois. */
export interface PostSaleSettingsView {
  settings: PostSaleAutomationSettings;
  missing: string[];
}

/**
 * Configuração da automação pós-fechamento. Toda referência a outra entidade
 * (estágio, template, responsável) é validada CONTRA A ORGANIZAÇÃO do
 * contexto autenticado antes de gravar -- é o que impede apontar a automação
 * de um tenant pra um estágio/usuário de outro. A FK sozinha não garante
 * isso: ela só exige que a linha exista em algum lugar.
 */
export class PostSaleSettingsService {
  constructor(
    private readonly repository: PostSaleAutomationRepository,
    private readonly pipelines: PipelineRepository,
    private readonly templates: BriefingTemplateRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  /**
   * Configuração default (tudo desligado) quando a organização nunca salvou
   * nada -- devolvida como objeto pra tela não precisar tratar `null`.
   *
   * `createdAt`/`updatedAt` são a EPOCH, não `new Date()`: o formulário usa
   * `updatedAt` como chave de sincronização, e um timestamp novo a cada
   * request faria a tela resetar o que o usuário está digitando a cada
   * refetch. `id` vazio marca "ainda não existe linha no banco".
   */
  private defaults(organizationId: string): PostSaleAutomationSettings {
    const now = new Date(0);
    return {
      id: "",
      organizationId,
      enabled: false,
      wonStageId: null,
      briefingTemplateKey: null,
      projectType: null,
      defaultOwnerId: null,
      createReceivables: true,
      installmentCount: null,
      entryDueDays: null,
      firstInstallmentDueDays: null,
      createBriefing: true,
      createProject: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  async get(organizationId: string): Promise<PostSaleSettingsView> {
    const settings =
      (await this.repository.findSettings(organizationId)) ?? this.defaults(organizationId);
    return { settings, missing: missingConfig(settings) };
  }

  listMembers(organizationId: string): Promise<OrganizationMember[]> {
    return this.memberships.listMembersForOrg(organizationId);
  }

  async update(
    organizationId: string,
    input: UpdatePostSaleSettingsRequest,
  ): Promise<PostSaleSettingsView> {
    if (input.wonStageId) {
      const stage = await this.pipelines.findStageForOrg(input.wonStageId, organizationId);
      if (!stage) throw new NotFoundError("Estágio de pipeline não encontrado.");
      // Mover o lead pra um estágio que não é de ganho deixaria `status` como
      // OPEN (LeadService.moveStage decide por isWon/isLost) -- a automação
      // "marcaria como ganho" sem marcar nada. Melhor recusar na configuração.
      if (!stage.isWon) {
        throw new ValidationError(
          `O estágio "${stage.name}" não está marcado como ganho. Escolha um estágio de ganho ou marque este como tal em Configurações > Pipeline.`,
        );
      }
    }

    if (input.briefingTemplateKey) {
      const template = await this.templates.findByKey(input.briefingTemplateKey, organizationId);
      if (!template) throw new NotFoundError("Template de briefing não encontrado.");
      // CUSTOM é um formulário montado pra UM envio (ver BriefingService.create,
      // que recusa reuso por chave) -- como padrão da automação ele quebraria
      // na primeira execução.
      if (template.kind === "CUSTOM") {
        throw new ValidationError(
          "Template personalizado não pode ser o padrão da automação (ele vale pra um envio só).",
        );
      }
    }

    if (input.defaultOwnerId) {
      const isMember = await this.memberships.isActiveMember(input.defaultOwnerId, organizationId);
      if (!isMember) throw new NotFoundError("Responsável não é membro ativo desta organização.");
    }

    const settings = await this.repository.upsertSettings(organizationId, input);
    return { settings, missing: missingConfig(settings) };
  }
}

/**
 * Lista legível do que impede a automação de rodar por completo. Função pura
 * (sem I/O) porque tanto o service quanto os testes precisam dela, e porque a
 * mesma resposta alimenta o aviso na tela de configurações.
 */
export function missingConfig(settings: PostSaleAutomationSettings): string[] {
  const missing: string[] = [];
  if (!settings.wonStageId) missing.push("Estágio de ganho do pipeline");
  if (settings.createReceivables) {
    if (settings.installmentCount == null) missing.push("Número padrão de parcelas");
    if (settings.entryDueDays == null) missing.push("Prazo de vencimento da entrada");
    if (settings.firstInstallmentDueDays == null) missing.push("Prazo da primeira parcela");
  }
  if (settings.createBriefing && !settings.briefingTemplateKey) {
    missing.push("Template padrão de briefing");
  }
  if (settings.createProject && !settings.projectType) missing.push("Tipo padrão de projeto");
  if (!settings.defaultOwnerId) missing.push("Responsável padrão");
  return missing;
}
