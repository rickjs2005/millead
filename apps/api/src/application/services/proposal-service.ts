import { NotFoundError } from "../../domain/errors/app-error.js";
import type {
  ProposalFilters,
  ProposalRepository,
  UpdateProposalInput,
} from "../../domain/repositories/proposal-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { CreateProposalInput } from "../dto/proposal.dto.js";
import type { ActivityLogger } from "./activity-logger.js";

const RESPONDED_STATUSES = new Set(["ACCEPTED", "REJECTED"]);

export class ProposalService {
  constructor(
    private readonly repository: ProposalRepository,
    private readonly activityLogger: ActivityLogger,
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

    const proposal = await this.repository.update(id, organizationId, resolvedPatch);
    if (!proposal) throw new NotFoundError("Proposta não encontrada.");

    if (patch.status === "SENT") {
      await this.activityLogger.log(organizationId, proposal.leadId, userId, "PROPOSAL_SENT", {
        proposalId: proposal.id,
        title: proposal.title,
      });
    }
    return proposal;
  }
}
