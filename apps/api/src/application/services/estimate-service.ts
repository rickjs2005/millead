import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { ProposalRepository } from "../../domain/repositories/proposal-repository.js";
import type { BlobStorage } from "../../domain/services/blob-storage.js";
import type { PricingEstimateWithItems } from "../../domain/entities/estimate.js";
import type {
  CostItemInput,
  ConvertEstimateInput,
  CreateEstimateInput,
  ListEstimatesQuery,
  UpdateEstimateInput,
} from "../dto/estimate.dto.js";
import { computeEstimate, type EstimateComputed } from "./estimate-calc.js";
import type { ActivityLogger } from "./activity-logger.js";
import {
  renderProposalPdf,
  type ProposalPdfData,
} from "../../infrastructure/proposals/pdf/render.js";

type EstimateWithComputed = PricingEstimateWithItems & { computed: EstimateComputed };

const MS_PER_DAY = 86_400_000;

export class EstimateService {
  constructor(
    private readonly repository: EstimateRepository,
    private readonly costs: CostRepository,
    private readonly leads: LeadRepository,
    private readonly companies: CompanyRepository,
    private readonly organizations: OrganizationRepository,
    private readonly proposals: ProposalRepository,
    private readonly blobStorage: BlobStorage,
    private readonly activityLogger: ActivityLogger,
    private readonly renderPdf: (data: ProposalPdfData) => Promise<Uint8Array> = renderProposalPdf,
  ) {}

  async list(
    organizationId: string,
    query: ListEstimatesQuery,
  ): Promise<{ items: EstimateWithComputed[]; total: number }> {
    const [result, settings] = await Promise.all([
      this.repository.list(organizationId, query),
      this.costs.getSettings(organizationId),
    ]);
    const usdToBrlRate = Number(settings.usdToBrlRate);
    return {
      items: result.items.map((item) => ({ ...item, computed: this.toComputed(item, usdToBrlRate) })),
      total: result.total,
    };
  }

  async get(organizationId: string, id: string): Promise<EstimateWithComputed> {
    const estimate = await this.repository.findById(organizationId, id);
    if (!estimate) throw new NotFoundError("Orçamento não encontrado.");
    return this.withComputed(estimate);
  }

  async create(
    organizationId: string,
    createdById: string,
    input: CreateEstimateInput,
  ): Promise<EstimateWithComputed> {
    await this.validateOwnership(organizationId, input);

    // Fase 5: sem auto-preenchimento -- ausente vira 0 (o rateio da agência
    // passa a ser coberto pela margem; o front pode ler /costs/summary e
    // usar o rateio atual via botão dedicado).
    const estimate = await this.repository.create(organizationId, createdById, {
      ...input,
      agencyShareMonthly: input.agencyShareMonthly ?? 0,
    });
    return this.withComputed(estimate);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateEstimateInput,
  ): Promise<EstimateWithComputed> {
    const existing = await this.repository.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Orçamento não encontrado.");
    if (existing.status === "CONVERTED") {
      throw new ConflictError("Orçamento convertido não pode ser alterado.");
    }

    await this.validateOwnership(organizationId, input);

    const estimate = await this.repository.update(organizationId, id, input);
    if (!estimate) throw new NotFoundError("Orçamento não encontrado.");
    return this.withComputed(estimate);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Orçamento não encontrado.");
    if (existing.status === "CONVERTED") {
      throw new ConflictError("Orçamento convertido não pode ser excluído.");
    }

    const ok = await this.repository.delete(organizationId, id);
    if (!ok) throw new NotFoundError("Orçamento não encontrado.");
  }

  listProducts(organizationId: string) {
    return this.repository.listProducts(organizationId);
  }

  /**
   * Converte um orçamento em proposta: cria a Proposal (DRAFT), gera o PDF
   * comercial (Task 1) e sobe pro Blob, marca o orçamento como CONVERTED e
   * loga a atividade na timeline do lead.
   *
   * Ordem de falha segura: se render/upload/update do PDF falhar DEPOIS de
   * criar a Proposal, a Proposal criada é apagada (cleanup) -- nunca fica
   * órfã sem pdfUrl, e o orçamento permanece intacto (não convertido).
   */
  async convert(
    organizationId: string,
    userId: string,
    id: string,
    input: ConvertEstimateInput,
  ): Promise<{ estimate: EstimateWithComputed; proposalId: string; pdfUrl: string }> {
    const estimate = await this.repository.findById(organizationId, id);
    if (!estimate) throw new NotFoundError("Orçamento não encontrado.");
    if (estimate.status === "CONVERTED") {
      throw new ConflictError("Este orçamento já foi convertido em proposta.");
    }
    if (!estimate.leadId) {
      throw new ValidationError("Vincule um lead ao orçamento antes de gerar a proposta.");
    }

    const lead = await this.leads.findByIdForOrg(estimate.leadId, organizationId);
    if (!lead) throw new NotFoundError("Lead não encontrado.");

    const [company, org, products, settings] = await Promise.all([
      lead.companyId ? this.companies.findByIdForOrg(lead.companyId, organizationId) : null,
      this.organizations.findById(organizationId),
      this.repository.listProducts(organizationId),
      this.costs.getSettings(organizationId),
    ]);

    const clientName = company?.name ?? lead.title;
    const orgName = org?.name ?? "MilLead";
    const productName = estimate.productId
      ? (products.find((p) => p.id === estimate.productId)?.name ?? null)
      : null;
    const computed = this.toComputed(estimate, Number(settings.usdToBrlRate));

    // Fase 6: `price` no body é opcional -- cascata price explícito >
    // finalPrice decidido pelo dono (se salvo) > preço recomendado calculado.
    const finalPrice = estimate.finalPrice != null ? Number(estimate.finalPrice) : null;
    const price = input.price ?? finalPrice ?? computed.priceRecommended;

    const validUntil = new Date(Date.now() + estimate.validDays * MS_PER_DAY);
    const proposal = await this.proposals.create({
      organizationId,
      leadId: estimate.leadId,
      createdById: userId,
      title: estimate.title,
      value: String(price),
      currency: "BRL",
      validUntil,
    });

    const proposalNumber = `${new Date().getFullYear()}-${proposal.id.slice(-6).toUpperCase()}`;

    let pdfUrl: string;
    try {
      const pdfBytes = await this.renderPdf({
        proposalNumber,
        orgName,
        clientName,
        projectTitle: estimate.title,
        productName,
        scopeItems: estimate.scopeItems,
        deadlineDays: estimate.deadlineDays,
        paymentTerms: estimate.paymentTerms,
        validDays: estimate.validDays,
        finalPrice: price,
        infraMonthlyBrl: computed.infraMonthlyBrl,
        infraMonths: estimate.infraMonths,
        domainYears: estimate.domainYears,
        domainCostBrl: computed.domainCost,
        createdAt: proposal.createdAt,
      });

      const upload = await this.blobStorage.upload({
        pathname: `proposals/${organizationId}/${proposal.id}.pdf`,
        buffer: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      });
      pdfUrl = upload.url;

      await this.proposals.update(proposal.id, organizationId, { pdfUrl });
    } catch (error) {
      // Cleanup best-effort: a causa raiz é o erro de render/upload acima --
      // se o PRÓPRIO delete falhar (ex.: DB transitório), só logamos e ainda
      // assim relançamos o erro ORIGINAL, nunca o do cleanup.
      try {
        await this.proposals.delete(proposal.id, organizationId);
      } catch (cleanupError) {
        // `config/logger.js` (pino) importa `config/env.js`, que valida
        // DATABASE_URL/JWT_ACCESS_SECRET/BLOB_READ_WRITE_TOKEN no import --
        // essa camada (`application/services`) é coberta por testes de
        // lógica pura (vitest.config.ts) sem esse ambiente configurado, e
        // nenhum outro service aqui importa o logger de infra. `console.error`
        // com contexto explícito evita acoplar o service ao setup de env só
        // pra logar uma falha de cleanup best-effort.
        console.error("convert: falha ao limpar proposal órfã após erro no PDF/upload", {
          proposalId: proposal.id,
          organizationId,
          cleanupError,
        });
      }
      throw error;
    }

    await this.repository.markConverted(organizationId, id, proposal.id);
    await this.activityLogger.log(organizationId, estimate.leadId, userId, "OTHER", {
      kind: "estimate_converted",
      estimateId: id,
      proposalId: proposal.id,
    });

    const reloaded = await this.get(organizationId, id);
    return { estimate: reloaded, proposalId: proposal.id, pdfUrl };
  }

  /**
   * Ownership de leadId/productId/subscriptionId -- roda ANTES de gravar
   * qualquer coisa. `null`/`undefined` pulam a validação (é assim que
   * update com `leadId: null` desvincula sem checar org); string sempre valida.
   */
  private async validateOwnership(
    organizationId: string,
    input: Partial<CreateEstimateInput>,
  ): Promise<void> {
    if (input.leadId) {
      const lead = await this.leads.findByIdForOrg(input.leadId, organizationId);
      if (!lead) throw new NotFoundError("Lead não encontrado.");
    }

    if (input.productId) {
      const products = await this.repository.listProducts(organizationId);
      const exists = products.some((p) => p.id === input.productId);
      if (!exists) throw new NotFoundError("Produto não encontrado.");
    }

    if (input.costItems) {
      const subscriptionIds = input.costItems
        .map((item: CostItemInput) => item.subscriptionId)
        .filter((id): id is string => Boolean(id));
      if (subscriptionIds.length > 0) {
        const subscriptions = await this.costs.listSubscriptions(organizationId);
        const validIds = new Set(subscriptions.map((s) => s.id));
        for (const subscriptionId of subscriptionIds) {
          if (!validIds.has(subscriptionId)) {
            throw new NotFoundError("Assinatura de custo não encontrada.");
          }
        }
      }
    }
  }

  private async withComputed(estimate: PricingEstimateWithItems): Promise<EstimateWithComputed> {
    const settings = await this.costs.getSettings(estimate.organizationId);
    return { ...estimate, computed: this.toComputed(estimate, Number(settings.usdToBrlRate)) };
  }

  private toComputed(estimate: PricingEstimateWithItems, usdToBrlRate: number): EstimateComputed {
    return computeEstimate({
      hourlyRate: Number(estimate.hourlyRate),
      hoursBreakdown: estimate.hoursBreakdown,
      costItems: estimate.costItems.map((item) => ({
        amount: Number(item.amount),
        currency: item.currency,
        billingCycle: item.billingCycle,
        isOneTime: item.isOneTime,
      })),
      agencyShareMonthly: Number(estimate.agencyShareMonthly),
      infraMonths: estimate.infraMonths,
      supportReservePct: Number(estimate.supportReservePct),
      marginPct: Number(estimate.marginPct),
      usdToBrlRate,
      domainYears: estimate.domainYears,
      domainYearPriceBrl: estimate.domainYearPriceBrl ? Number(estimate.domainYearPriceBrl) : 0,
    });
  }
}
