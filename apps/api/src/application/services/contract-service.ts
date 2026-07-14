import type { ContractStatus } from "@millead/database";
import { env } from "../../config/env.js";
import type {
  ContractedSnapshot,
  ContractorSnapshot,
} from "../../domain/entities/contract.js";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/errors/app-error.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type {
  ContractFilters,
  ContractRepository,
} from "../../domain/repositories/contract-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { ContractNotifier } from "../../domain/services/contract-notifier.js";
import type { ContractQueue } from "../../domain/services/contract-queue.js";
import type {
  ContractSignatureGateway,
  WebhookHeaders,
} from "../../domain/services/contract-signature.js";
import type { PaginationParams } from "../../shared/pagination.js";

export interface CreateContractRequestData {
  // Contratante
  tipoPessoa: "PF" | "PJ";
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  nomeEmpresa?: string;
  // Projeto
  tipo: "SITE" | "SISTEMA" | "SAAS" | "MANUTENCAO" | "CONSULTORIA";
  descricaoProjeto: string;
  valorTotal: number;
  formaPagamento: "PIX" | "BOLETO" | "CARTAO" | "TRANSFERENCIA" | "PARCELADO";
  percentualEntrada: number;
  prazoEntregaDias: number;
  limiteRevisoes?: number;
  leadId?: string;
}

const MANUAL_STATUSES: ContractStatus[] = ["CANCELADO", "EXPIRADO", "AGUARDANDO_ASSINATURA"];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export class ContractService {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly companies: CompanyRepository,
    private readonly organizations: OrganizationRepository,
    private readonly queue: ContractQueue,
    private readonly gateway: ContractSignatureGateway,
    private readonly notifier: ContractNotifier,
  ) {}

  private contractedSnapshot(orgName: string): ContractedSnapshot {
    return {
      razaoSocial: env.CONTRACTOR_RAZAO_SOCIAL ?? orgName,
      cnpj: env.CONTRACTOR_CNPJ ?? "",
      docLabel: env.CONTRACTOR_DOC_LABEL,
      endereco: env.CONTRACTOR_ENDERECO ?? "",
      email: env.CONTRACTOR_EMAIL ?? "",
      foro: env.CONTRACTOR_FORO ?? "Comarca da sede da CONTRATADA",
    };
  }

  /** Cria contrato + vincula/cria a Company pelo documento + enfileira o processamento. */
  async create(
    organizationId: string,
    createdById: string | null,
    input: CreateContractRequestData,
    origem: "APP" | "PUBLIC_FORM",
  ) {
    const organization = await this.organizations.findById(organizationId);
    if (!organization) throw new NotFoundError("Organização não encontrada.");

    const documento = input.documento.replace(/\D/g, "");
    let company = await this.companies.findByDocumentForOrg(documento, organizationId);
    if (!company) {
      company = await this.companies.create({
        organizationId,
        name: input.nomeEmpresa?.trim() || input.nome,
        document: documento,
        email: input.email,
        phone: input.telefone,
      });
    }

    const contractorSnapshot: ContractorSnapshot = {
      tipoPessoa: input.tipoPessoa,
      nome: input.nome,
      documento,
      email: input.email,
      telefone: input.telefone,
      endereco: input.endereco,
      nomeEmpresa: input.nomeEmpresa ?? null,
    };

    const numeroPrefix =
      organization.slug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "CONTRATO";

    const contract = await this.contracts.create({
      organizationId,
      companyId: company.id,
      leadId: input.leadId ?? null,
      createdById,
      numeroPrefix,
      tipo: input.tipo,
      descricaoProjeto: input.descricaoProjeto,
      valorTotal: input.valorTotal.toFixed(2),
      formaPagamento: input.formaPagamento,
      percentualEntrada: input.percentualEntrada.toFixed(2),
      prazoEntregaDias: input.prazoEntregaDias,
      limiteRevisoes: input.limiteRevisoes ?? 2,
      contractorSnapshot,
      contractedSnapshot: this.contractedSnapshot(organization.name),
      provider: this.gateway.nome,
      origem,
    });

    await this.queue.enqueue({ contractId: contract.id, organizationId });
    return contract;
  }

  /** Formulário público: resolve a organização pelo slug da URL. */
  async createPublic(organizationSlug: string, input: CreateContractRequestData) {
    const organization = await this.organizations.findBySlug(organizationSlug);
    if (!organization) throw new NotFoundError("Organização não encontrada.");
    return this.create(organization.id, null, input, "PUBLIC_FORM");
  }

  list(organizationId: string, filters: ContractFilters, pagination: PaginationParams) {
    return this.contracts.list(organizationId, filters, pagination);
  }

  kpis(organizationId: string) {
    return this.contracts.kpis(organizationId);
  }

  async get(organizationId: string, id: string) {
    const contract = await this.contracts.findByIdForOrg(id, organizationId);
    if (!contract) throw new NotFoundError("Contrato não encontrado.");
    return contract;
  }

  /** Transições manuais permitidas (espelha o sistema original). */
  async updateStatus(organizationId: string, id: string, status: ContractStatus) {
    if (!MANUAL_STATUSES.includes(status)) {
      throw new ValidationError(
        "Só é permitido alterar manualmente para CANCELADO, EXPIRADO ou AGUARDANDO_ASSINATURA.",
      );
    }
    const contract = await this.contracts.updateStatus(id, organizationId, status);
    if (!contract) throw new NotFoundError("Contrato não encontrado.");
    await this.contracts.addEvent(id, organizationId, `STATUS_${status}`, "ADMIN");
    return contract;
  }

  /** Reenfileira o processamento (PDF + assinatura) de um contrato travado. */
  async reprocess(organizationId: string, id: string) {
    const contract = await this.contracts.findByIdForOrg(id, organizationId);
    if (!contract) throw new NotFoundError("Contrato não encontrado.");
    if (contract.status === "ASSINADO") {
      throw new ValidationError("Contrato já assinado não pode ser reprocessado.");
    }
    await this.contracts.addEvent(id, organizationId, "REPROCESSAMENTO", "ADMIN");
    await this.queue.enqueue({ contractId: id, organizationId });
    return contract;
  }

  async getPdf(organizationId: string, id: string, versao: "original" | "assinado") {
    const pdf = await this.contracts.getPdf(id, organizationId, versao);
    if (!pdf) throw new NotFoundError("PDF não disponível pra este contrato.");
    return pdf;
  }

  /**
   * Webhook do provedor de assinatura. `rawBody` é o corpo cru (HMAC);
   * best-effort e idempotente.
   */
  async handleSignatureWebhook(headers: WebhookHeaders, rawBody: string, body: unknown) {
    if (!this.gateway.verificarAssinatura(headers, rawBody)) {
      throw new UnauthorizedError("Assinatura do webhook inválida.");
    }
    const resultado = this.gateway.interpretarWebhook(body);
    if (!resultado.docId) throw new ValidationError("Webhook sem docId.");

    const contract = await this.contracts.findBySignatureDocId(resultado.docId);
    if (!contract) throw new NotFoundError("Contrato do webhook não encontrado.");

    if (resultado.evento === "VISUALIZADO") {
      await this.contracts.addEvent(contract.id, contract.organizationId, "VISUALIZADO", "WEBHOOK");
      return { ok: true };
    }
    if (resultado.evento !== "ASSINADO") {
      await this.contracts.addEvent(
        contract.id,
        contract.organizationId,
        `WEBHOOK_${resultado.evento}`,
        "WEBHOOK",
        { raw: resultado.raw },
      );
      return { ok: true };
    }

    // Idempotência: assinado duas vezes não refaz nada.
    if (contract.status === "ASSINADO") return { ok: true };

    let pdfAssinado: Buffer | null = null;
    if (resultado.pdfAssinadoUrl) {
      try {
        const res = await fetch(resultado.pdfAssinadoUrl);
        if (res.ok) pdfAssinado = Buffer.from(await res.arrayBuffer());
      } catch {
        // best-effort: sem o PDF assinado ainda marcamos como assinado
      }
    }

    const assinadoEm = resultado.assinadoEm ? new Date(resultado.assinadoEm) : new Date();
    await this.contracts.markSigned(contract.id, assinadoEm, pdfAssinado);
    await this.contracts.addEvent(contract.id, contract.organizationId, "ASSINADO", "WEBHOOK");

    const contractor = contract.contractorSnapshot as ContractorSnapshot;
    void this.notifier.contratoAssinado({
      numero: contract.numero,
      nomeCliente: contractor.nome,
      emailCliente: contractor.email,
      telefoneCliente: contractor.telefone,
      valorFormatado: BRL.format(Number(contract.valorTotal)),
      pdfAssinado,
    });

    return { ok: true };
  }
}
