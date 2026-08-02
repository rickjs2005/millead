import { Prisma } from "@millead/database";
import { env } from "../../config/env.js";
import { ConflictError, NotFoundError } from "../../domain/errors/app-error.js";
import type { Proposal } from "../../domain/entities/proposal.js";
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
  ) {}

  create(organizationId: string, createdById: string, input: CreateProposalInput) {
    return this.repository.create({ organizationId, createdById, ...input });
  }

  async get(organizationId: string, id: string) {
    const proposal = await this.repository.findByIdForOrg(id, organizationId);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");
    return proposal;
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

    // Precisa da proposta atual pra (a) saber se já tem publicToken (SENT
    // não gera de novo, senão reenvio invalidaria um link já compartilhado)
    // e (b) checar se uma decisão manual ia sobrescrever o aceite/rejeição
    // que o cliente já deu pelo link público.
    let current: Proposal | null = null;
    if (patch.status === "SENT" || (patch.status && RESPONDED_STATUSES.has(patch.status))) {
      current = await this.repository.findByIdForOrg(id, organizationId);
      if (!current) throw new NotFoundError("Proposta não encontrada.");
    }

    if (patch.status && RESPONDED_STATUSES.has(patch.status) && current?.decidedAt) {
      throw new ConflictError(
        "Esta proposta já foi decidida pelo cliente pelo link público.",
      );
    }

    let generatedToken: string | null = null;
    if (patch.status === "SENT" && !current?.publicToken) {
      generatedToken = generatePublicToken();
      resolvedPatch.publicToken = generatedToken;
    }

    let proposal: Proposal | null;
    try {
      proposal = await this.repository.update(id, organizationId, resolvedPatch);
    } catch (err) {
      // Colisão de unique no publicToken (~100 bits de entropia -- deveria
      // nunca acontecer na prática): 1 retry com token novo já resolve.
      if (
        generatedToken &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        resolvedPatch.publicToken = generatePublicToken();
        proposal = await this.repository.update(id, organizationId, resolvedPatch);
      } else {
        throw err;
      }
    }
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
          publicUrl: proposal.publicToken ? `${env.WEB_PUBLIC_URL}/p/${proposal.publicToken}` : null,
        });
      }
    }
    return proposal;
  }
}
