import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { BriefingAnswerRepository } from "../../domain/repositories/briefing-answer-repository.js";
import type { BriefingRepository } from "../../domain/repositories/briefing-repository.js";
import type { BriefingQueue } from "../../domain/services/briefing-queue.js";
import type { ActivityLogger } from "./activity-logger.js";

/**
 * Fecha o formulário público: valida obrigatórios, marca COMPLETED e
 * enfileira o processamento (PDF + notificações) -- rodado pelo worker,
 * nunca síncrono na requisição do cliente.
 */
export class BriefingCompletionService {
  constructor(
    private readonly briefings: BriefingRepository,
    private readonly answers: BriefingAnswerRepository,
    private readonly queue: BriefingQueue,
    private readonly activityLogger: ActivityLogger,
  ) {}

  async complete(token: string) {
    const briefing = await this.briefings.findByToken(token);
    if (!briefing) throw new NotFoundError("Link inválido ou expirado.");
    if (briefing.status === "ARCHIVED") {
      throw new ValidationError("Este briefing foi arquivado.");
    }
    if (briefing.status === "COMPLETED") {
      return briefing; // idempotente -- reenviar "concluir" não reprocessa
    }

    const currentAnswers = await this.answers.listForBriefing(briefing.id, briefing.organizationId);
    const answeredFieldIds = new Set(currentAnswers.map((a) => a.fieldId));
    const missing = briefing.template.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.required)
      .filter((f) => {
        if (f.type === "GROUP") {
          return !(f.children ?? []).some((c) => answeredFieldIds.has(c.id));
        }
        return !answeredFieldIds.has(f.id);
      });

    if (missing.length > 0) {
      throw new ValidationError(
        `Faltam campos obrigatórios: ${missing.map((f) => f.label).join(", ")}.`,
        { fields: missing.map((f) => f.id) },
      );
    }

    const completedAt = new Date();
    // reatribui `briefing`: o objeto carregado no topo ainda tem o status
    // pré-conclusão -- devolver ele faria o caller (wizard) achar que o
    // briefing continua IN_PROGRESS logo depois de "Finalizar".
    const updated = await this.briefings.updateStatus(briefing.id, "COMPLETED", { completedAt });
    if (!updated) throw new NotFoundError("Briefing não encontrado.");
    await this.briefings.updateProgress(briefing.id, 100);
    await this.briefings.addHistory(briefing.id, briefing.organizationId, "CONCLUIDO", "PUBLIC_FORM");
    if (briefing.leadId) {
      await this.activityLogger.log(
        briefing.organizationId,
        briefing.leadId,
        null,
        "BRIEFING_COMPLETED",
        { briefingId: briefing.id, templateKind: briefing.template.kind },
      );
    }
    await this.queue.enqueue({ briefingId: briefing.id, organizationId: briefing.organizationId });

    return { ...updated, progressPercent: 100 };
  }
}
