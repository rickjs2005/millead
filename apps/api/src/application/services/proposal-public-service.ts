import { ConflictError, GoneError, NotFoundError } from "../../domain/errors/app-error.js";
import type { Proposal } from "../../domain/entities/proposal.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { EstimateRepository } from "../../domain/repositories/estimate-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { ProposalRepository } from "../../domain/repositories/proposal-repository.js";
import type { ProposalNotifier } from "../../domain/services/proposal-notifier.js";
import type { PushSender } from "../../domain/services/push-sender.js";
import type { ContractService } from "./contract-service.js";
import type { ActivityLogger } from "./activity-logger.js";

/** Vista pública da proposta (/p/:token) -- Task 5 consome isto. */
export interface PublicProposalView {
  title: string;
  value: string;
  currency: string;
  validUntil: string | null; // ISO
  organizationName: string;
  pdfUrl: string | null;
  scopeItems: string[]; // do estimate, [] se nao houver
  status: "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
}

const ALREADY_DECIDED_STATUSES = new Set(["ACCEPTED", "REJECTED"]);

function formatValor(valor: string, currency: string): string {
  const n = Number(valor);
  if (Number.isNaN(n)) return valor;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

/**
 * Fluxo público de aceite/recusa da proposta (/p/:token) -- sem
 * autenticação, protegido só pela imprevisibilidade do token. Toda
 * transição de status é atômica no repositório (CAS via updateMany); este
 * service nunca decide status com um "ler, comparar em memória, escrever"
 * porque duas abas/cliques concorrentes do mesmo cliente correm nessa janela.
 */
export class ProposalPublicService {
  constructor(
    private readonly proposals: ProposalRepository,
    private readonly estimates: EstimateRepository,
    private readonly leads: LeadRepository,
    private readonly companies: CompanyRepository,
    private readonly organizations: OrganizationRepository,
    private readonly contracts: ContractService,
    private readonly notifier: ProposalNotifier,
    private readonly push: PushSender,
    private readonly activityLogger: ActivityLogger,
  ) {}

  /** Marca VIEWED na 1a chamada com status SENT (idempotente nas seguintes). */
  async getByToken(token: string): Promise<PublicProposalView> {
    const proposal = await this.proposals.findByPublicToken(token);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");

    let status = proposal.status;
    if (status === "SENT") {
      const marked = await this.proposals.markViewed(proposal.id, new Date());
      if (marked) {
        status = "VIEWED";
        await this.activityLogger.log(proposal.organizationId, proposal.leadId, null, "OTHER", {
          kind: "proposal_viewed_public",
          proposalId: proposal.id,
        });
      }
    }

    const [estimate, organization] = await Promise.all([
      this.estimates.findByProposalId(proposal.id),
      this.organizations.findById(proposal.organizationId),
    ]);

    return {
      title: proposal.title,
      value: proposal.value,
      currency: proposal.currency,
      validUntil: proposal.validUntil ? proposal.validUntil.toISOString() : null,
      organizationName: organization?.name ?? "",
      pdfUrl: proposal.pdfUrl,
      scopeItems: estimate?.scopeItems ?? [],
      status: status as PublicProposalView["status"],
    };
  }

  async accept(token: string, ip: string | null): Promise<{ status: string }> {
    const proposal = await this.proposals.findByPublicToken(token);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");
    return this.decide(proposal, "ACCEPTED", ip);
  }

  async reject(token: string, ip: string | null, reason?: string): Promise<{ status: string }> {
    const proposal = await this.proposals.findByPublicToken(token);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");
    return this.decide(proposal, "REJECTED", ip, reason);
  }

  private async decide(
    proposal: Proposal,
    decision: "ACCEPTED" | "REJECTED",
    ip: string | null,
    reason?: string,
  ): Promise<{ status: string }> {
    // Idempotência: reenvio do mesmo clique (retry de rede, duplo tap) não
    // deve reprocessar nada -- nem recriar o contrato, nem renotificar.
    if (proposal.status === decision) return { status: decision };
    if (ALREADY_DECIDED_STATUSES.has(proposal.status)) {
      throw new ConflictError("Esta proposta já foi decidida.");
    }
    if (proposal.status === "EXPIRED" || this.isExpired(proposal)) {
      if (proposal.status !== "EXPIRED") await this.proposals.markExpired(proposal.id);
      throw new GoneError("Esta proposta expirou.");
    }

    const decidedAt = new Date();
    let decided = await this.proposals.decide(proposal.id, decision, {
      decidedAt,
      decisionIp: ip,
      rejectReason: decision === "REJECTED" ? reason : undefined,
    });

    if (!decided) {
      // CAS perdeu a corrida -- relê o estado real e responde de acordo,
      // em vez de assumir sucesso ou erro genérico.
      const reread = await this.proposals.findByIdForOrg(proposal.id, proposal.organizationId);
      if (!reread) throw new NotFoundError("Proposta não encontrada.");
      if (reread.status === decision) return { status: decision }; // outra requisição já tomou a MESMA decisão
      if (ALREADY_DECIDED_STATUSES.has(reread.status)) {
        throw new ConflictError("Esta proposta já foi decidida.");
      }
      throw new ConflictError("Não foi possível registrar a decisão -- tente novamente.");
    }
    decided = decided as Proposal;

    if (decision === "ACCEPTED") {
      const { contractCreated, contractFailReason } = await this.createDraftBestEffort(decided);

      await this.activityLogger.log(decided.organizationId, decided.leadId, null, "OTHER", {
        kind: "proposal_accepted_public",
        proposalId: decided.id,
        contractCreated,
      });

      void this.push
        .sendToOrg(decided.organizationId, {
          title: "✅ Proposta aceita!",
          body: `${decided.title} — ${formatValor(decided.value, decided.currency)}`,
          url: "/proposals",
        })
        .catch(() => null);

      void this.notifier
        .propostaDecidida({
          titulo: decided.title,
          valor: decided.value,
          decision: "ACCEPTED",
          rejectReason: null,
          contractCreated,
          contractFailReason,
          proposalId: decided.id,
        })
        .catch(() => null);
    } else {
      await this.activityLogger.log(decided.organizationId, decided.leadId, null, "OTHER", {
        kind: "proposal_rejected_public",
        proposalId: decided.id,
      });

      void this.push
        .sendToOrg(decided.organizationId, {
          title: "❌ Proposta recusada",
          body: reason ? `${decided.title} — ${reason}` : decided.title,
          url: "/proposals",
        })
        .catch(() => null);

      void this.notifier
        .propostaDecidida({
          titulo: decided.title,
          valor: decided.value,
          decision: "REJECTED",
          rejectReason: reason ?? null,
          contractCreated: false,
          contractFailReason: null,
          proposalId: decided.id,
        })
        .catch(() => null);
    }

    return { status: decision };
  }

  private isExpired(proposal: Proposal): boolean {
    return proposal.validUntil !== null && proposal.validUntil.getTime() < Date.now();
  }

  /**
   * Best-effort de verdade: o aceite é o fato consumado (já persistido antes
   * desta chamada) -- QUALQUER falha aqui (ValidationError de dado faltando,
   * NotFoundError de organização, erro de banco, timeout, o que for) NUNCA
   * derruba o accept() nem desfaz a decisão já gravada. Ela só vira
   * `contractCreated: false` + motivo, que a notificação do dono carrega pra
   * ele resolver manualmente. Ver `application/services` -- esta camada não
   * importa `config/logger` (precisa de env que os testes de lógica pura não
   * configuram), daí `console.error` com contexto explícito, mesmo padrão do
   * cleanup best-effort em `estimate-service.ts`.
   */
  private async createDraftBestEffort(
    proposal: Proposal,
  ): Promise<{ contractCreated: boolean; contractFailReason: string | null }> {
    try {
      const [lead, estimate] = await Promise.all([
        this.leads.findByIdForOrg(proposal.leadId, proposal.organizationId),
        this.estimates.findByProposalId(proposal.id),
      ]);
      const company = lead?.companyId
        ? await this.companies.findByIdForOrg(lead.companyId, proposal.organizationId)
        : null;
      const contact = lead?.contacts.find((c) => c.isPrimary) ?? lead?.contacts[0] ?? null;

      await this.contracts.createDraftFromProposal({
        proposal,
        estimate: estimate
          ? { scopeItems: estimate.scopeItems, deadlineDays: estimate.deadlineDays }
          : null,
        company: company
          ? {
              id: company.id,
              name: company.name,
              document: company.document,
              email: company.email,
              phone: company.phone,
            }
          : null,
        contact: contact ? { name: contact.name, email: contact.email, phone: contact.phone } : null,
      });
      return { contractCreated: true, contractFailReason: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido ao criar contrato.";
      console.error(
        "accept: falha ao criar contrato rascunho a partir da proposta aceita (best-effort, aceite mantido)",
        { proposalId: proposal.id, organizationId: proposal.organizationId, err },
      );
      return { contractCreated: false, contractFailReason: message };
    }
  }
}
