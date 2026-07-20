import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { BriefingAnswerRepository } from "../../domain/repositories/briefing-answer-repository.js";
import type { BriefingRepository } from "../../domain/repositories/briefing-repository.js";
import type { BriefingQueue } from "../../domain/services/briefing-queue.js";
import { answerHasValue } from "./briefing-answer-service.js";
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
    // só conta como preenchido quem tem valor de verdade (não a linha vazia
    // que o autosave deixa quando o cliente digita e apaga) -- ver answerHasValue.
    const answeredFieldIds = new Set(
      currentAnswers.filter(answerHasValue).map((a) => a.fieldId),
    );
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
    // Transição atômica: só UMA chamada `complete` concorrente ganha a corrida
    // (updateMany condicionado a status != COMPLETED). As demais recebem null
    // e retornam sem re-enfileirar -- evita PDF/e-mail duplicados.
    const updated = await this.briefings.markCompleted(briefing.id, completedAt);
    if (!updated) {
      return { ...briefing, status: "COMPLETED" as const, progressPercent: 100 };
    }
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
