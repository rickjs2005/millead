import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { BriefingAnswerRepository } from "../../domain/repositories/briefing-answer-repository.js";
import type { BriefingRepository } from "../../domain/repositories/briefing-repository.js";
import type { BriefingQueue } from "../../domain/services/briefing-queue.js";
import { answerHasValue } from "./briefing-answer-service.js";
import type { ActivityLogger } from "./activity-logger.js";

function isHttpUrl(text: string): boolean {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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
    const withValue = currentAnswers.filter(answerHasValue);
    const answeredFieldIds = new Set(withValue.map((a) => a.fieldId));

    const missingLabels: string[] = [];
    const missingIds: string[] = [];
    const topFields = briefing.template.sections.flatMap((s) => s.fields);

    for (const f of topFields) {
      if (f.type === "GROUP") {
        const children = f.children ?? [];
        const childIds = new Set(children.map((c) => c.id));
        // itens realmente preenchidos deste grupo (groupItemId com algum valor)
        const itemIds = [
          ...new Set(
            withValue
              .filter((a) => a.groupItemId && childIds.has(a.fieldId))
              .map((a) => a.groupItemId),
          ),
        ];
        if (f.required && itemIds.length === 0) {
          missingLabels.push(f.label);
          missingIds.push(f.id);
          continue;
        }
        // todo item PRESENTE precisa dos filhos obrigatórios preenchidos --
        // antes bastava 1 subcampo qualquer pro grupo inteiro "contar".
        const requiredChildren = children.filter((c) => c.required);
        for (const [i, itemId] of itemIds.entries()) {
          const answeredInItem = new Set(
            withValue.filter((a) => a.groupItemId === itemId).map((a) => a.fieldId),
          );
          for (const rc of requiredChildren) {
            if (!answeredInItem.has(rc.id)) {
              missingLabels.push(`${f.label} (item ${i + 1}): ${rc.label}`);
              missingIds.push(rc.id);
            }
          }
        }
      } else if (f.required && !answeredFieldIds.has(f.id)) {
        missingLabels.push(f.label);
        missingIds.push(f.id);
      }
    }

    if (missingLabels.length > 0) {
      throw new ValidationError(`Faltam campos obrigatórios: ${missingLabels.join(", ")}.`, {
        fields: missingIds,
      });
    }

    // Formato de EMAIL/URL/PHONE é checado AQUI (envio final), não no
    // autosave -- validar a cada tecla rejeitaria o valor parcial de quem
    // ainda está digitando ("joao@gm...") e quebraria o rascunho automático.
    const fieldById = new Map(
      topFields.flatMap((f) => [f, ...(f.children ?? [])]).map((f) => [f.id, f]),
    );
    const invalid: { label: string; id: string }[] = [];
    for (const a of withValue) {
      const field = fieldById.get(a.fieldId);
      const text = a.valueText?.trim();
      if (!field || !text) continue;
      if (field.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
        invalid.push({ label: field.label, id: field.id });
      } else if (field.type === "URL" && !isHttpUrl(text)) {
        invalid.push({ label: field.label, id: field.id });
      } else if (field.type === "PHONE") {
        const digits = text.replace(/\D/g, "");
        if (digits.length < 8 || digits.length > 15)
          invalid.push({ label: field.label, id: field.id });
      }
    }
    if (invalid.length > 0) {
      throw new ValidationError(
        `Verifique o preenchimento destes campos: ${invalid.map((i) => i.label).join(", ")}.`,
        { fields: invalid.map((i) => i.id) },
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
    await this.briefings.addHistory(
      briefing.id,
      briefing.organizationId,
      "CONCLUIDO",
      "PUBLIC_FORM",
    );
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
