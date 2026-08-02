import { Prisma } from "@millead/database";
import { env } from "../../config/env.js";
import { ConflictError, NotFoundError } from "../../domain/errors/app-error.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type {
  ProposalFilters,
  ProposalRepository,
  UpdateProposalInput,
} from "../../domain/repositories/proposal-repository.js";
import type { ProposalNotifier } from "../../domain/services/proposal-notifier.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { CreateProposalInput } from "../dto/proposal.dto.js";
import type { ActivityLogger } from "./activity-logger.js";
import { generatePublicToken } from "./public-token.js";

const RESPONDED_STATUSES = new Set(["ACCEPTED", "REJECTED"]);

export class ProposalService {
  constructor(
    private readonly repository: ProposalRepository,
    private readonly activityLogger: ActivityLogger,
    private readonly leads: LeadRepository,
    private readonly organizations: OrganizationRepository,
    private readonly notifier: ProposalNotifier,
    private readonly contracts: ContractRepository,
  ) {}

  create(organizationId: string, createdById: string, input: CreateProposalInput) {
    return this.repository.create({ organizationId, createdById, ...input });
  }

  /** Detalhe autenticado: inclui `contractId` do contrato já gerado a partir
   * desta proposta (best-effort, 1 query extra -- null se ainda não houver
   * contrato). Usado pela tela de detalhe da proposta pra linkar "Ver contrato". */
  async get(organizationId: string, id: string) {
    const proposal = await this.repository.findByIdForOrg(id, organizationId);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");
    const contract = await this.contracts.findByProposalId(id);
    return { ...proposal, contractId: contract?.id ?? null };
  }

  list(organizationId: string, filters: ProposalFilters, pagination: PaginationParams) {
    return this.repository.list(organizationId, filters, pagination);
  }

  async update(organizationId: string, userId: string, id: string, patch: UpdateProposalInput) {
    const resolvedPatch: UpdateProposalInput = { ...patch };
    if (patch.status === "SENT" && resolvedPatch.sentAt === undefined) {
      resolvedPatch.sentAt = new Date();
    }
    if (
      patch.status &&
      RESPONDED_STATUSES.has(patch.status) &&
      resolvedPatch.respondedAt === undefined
    ) {
      resolvedPatch.respondedAt = new Date();
    }

    // Guarda: decisão manual (ACCEPTED/REJECTED) não pode sobrescrever uma
    // decisão que o cliente já tomou pelo link público.
    if (patch.status && RESPONDED_STATUSES.has(patch.status)) {
      const current = await this.repository.findByIdForOrg(id, organizationId);
      if (!current) throw new NotFoundError("Proposta não encontrada.");
      if (current.decidedAt) {
        throw new ConflictError(
          "Esta proposta já foi decidida pelo cliente pelo link público.",
        );
      }
    }

    // Token do link público: CAS no repositório, ANTES do update de status.
    // Duas transições SENT concorrentes chamam ensurePublicToken em
    // paralelo; só a primeira grava, a segunda recebe de volta o mesmo
    // token -- nenhuma das duas manda e-mail com um link que a outra
    // invalidou. publicToken nunca entra no patch genérico (só esse
    // caminho escreve nele).
    let publicToken: string | null = null;
    if (patch.status === "SENT") {
      publicToken = await this.ensurePublicTokenWithRetry(id, organizationId);
    }

    const proposal = await this.repository.update(id, organizationId, resolvedPatch);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");

    if (patch.status === "SENT") {
      await this.activityLogger.log(organizationId, proposal.leadId, userId, "PROPOSAL_SENT", {
        proposalId: proposal.id,
        title: proposal.title,
      });

      // Envio real (best-effort): e-mail pro contato principal do lead, se
      // ele tiver e-mail cadastrado. Sem SMTP configurado vira no-op logado.
      const [lead, org] = await Promise.all([
        this.leads.findByIdForOrg(proposal.leadId, organizationId),
        this.organizations.findById(organizationId),
      ]);
      const contato =
        lead?.contacts.find((c) => c.isPrimary && c.email) ?? lead?.contacts.find((c) => c.email);
      if (contato?.email) {
        await this.notifier.propostaEnviada({
          titulo: proposal.title,
          valor: proposal.value,
          currency: proposal.currency,
          validUntil: proposal.validUntil,
          nomeCliente: contato.name,
          emailCliente: contato.email,
          pdfUrl: proposal.pdfUrl ?? null,
          nomeOrganizacao: org?.name ?? "MilLead",
          publicUrl: publicToken
            ? `${env.WEB_PUBLIC_URL.replace(/\/+$/, "")}/p/${publicToken}`
            : null,
        });
      }
    }
    return proposal;
  }

  /** CAS com 1 retry: colisão de unique entre propostas diferentes (~100 bits
   * de entropia -- teoricamente possível, na prática nunca visto) resolve
   * gerando outro token e tentando de novo. */
  private async ensurePublicTokenWithRetry(
    id: string,
    organizationId: string,
  ): Promise<string | null> {
    try {
      return await this.repository.ensurePublicToken(id, organizationId, generatePublicToken());
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.repository.ensurePublicToken(id, organizationId, generatePublicToken());
      }
      throw err;
    }
  }
}
