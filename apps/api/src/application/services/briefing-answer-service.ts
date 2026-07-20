import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  BriefingAnswer,
  BriefingDetail,
  BriefingField,
  BriefingTemplateDetail,
} from "../../domain/entities/briefing.js";
import type { BriefingAnswerRepository } from "../../domain/repositories/briefing-answer-repository.js";
import type { BriefingRepository } from "../../domain/repositories/briefing-repository.js";

export interface SaveAnswerInput {
  fieldId: string;
  groupItemId?: string;
  groupItemOrder?: number | null;
  valueText?: string | null;
  valueJson?: unknown;
}

/**
 * Uma resposta só CONTA (pra progresso e pra checagem de obrigatório) quando
 * tem valor de verdade -- não basta a linha existir. O autosave grava até
 * `""`/array vazio (cliente digita e apaga), então contar só a presença da
 * linha deixava obrigatório passar em branco e o progresso ir a 100% vazio.
 */
export function answerHasValue(a: Pick<BriefingAnswer, "valueText" | "valueJson">): boolean {
  if (typeof a.valueText === "string" && a.valueText.trim() !== "") return true;
  if (Array.isArray(a.valueJson)) return a.valueJson.length > 0;
  return false;
}

/** Projeção pública do briefing (o que o wizard consome) -- sem organizationId,
 * leadId, companyId, createdById, histórico nem contato: nada disso pertence a
 * quem só tem o link público. */
export type PublicBriefingView = Pick<
  BriefingDetail,
  "id" | "status" | "progressPercent" | "template" | "answers" | "files"
>;

/**
 * Autosave de campo individual (público, sem auth -- resolve tudo via
 * token). Progresso é recalculado a cada resposta e os campos de contato
 * (nome/email/telefone) são denormalizados pra `Briefing` conforme a seção
 * "empresa" é preenchida, porque a lista admin precisa mostrar "cliente"
 * mesmo sem Lead/Company vinculado.
 */
export class BriefingAnswerService {
  constructor(
    private readonly briefings: BriefingRepository,
    private readonly answers: BriefingAnswerRepository,
  ) {}

  private async loadByToken(token: string) {
    const briefing = await this.briefings.findByToken(token);
    if (!briefing) throw new NotFoundError("Link inválido ou expirado.");
    if (briefing.status === "ARCHIVED") {
      throw new ValidationError("Este briefing foi arquivado e não aceita mais respostas.");
    }
    return briefing;
  }

  /** getByToken deixa o COMPLETED passar (tela de sucesso/reabertura ainda
   * precisa ler os dados) -- só as mutações abaixo bloqueiam pra não deixar
   * o PDF/e-mail já enviados ficarem dessincronizados de uma edição tardia. */
  private assertEditable(briefing: { status: string }) {
    if (briefing.status === "COMPLETED") {
      throw new ValidationError("Este briefing já foi concluído e não aceita mais alterações.");
    }
  }

  async getByToken(token: string): Promise<PublicBriefingView> {
    const briefing = await this.loadByToken(token);
    return {
      id: briefing.id,
      status: briefing.status,
      progressPercent: briefing.progressPercent,
      template: briefing.template,
      answers: briefing.answers,
      files: briefing.files,
    };
  }

  async saveAnswer(token: string, input: SaveAnswerInput) {
    const briefing = await this.loadByToken(token);
    this.assertEditable(briefing);
    const located = findFieldById(briefing.template, input.fieldId);
    if (!located) throw new ValidationError("Campo não pertence a este template.");
    const { field, sectionKey } = located;
    if (field.type === "GROUP") {
      throw new ValidationError("Não é possível responder o campo-container de um grupo.");
    }
    // campo-filho de GROUP precisa de groupItemId; campo de topo não usa.
    const groupItemId = field.parentFieldId ? (input.groupItemId ?? "") : "";
    if (field.parentFieldId && !groupItemId) {
      throw new ValidationError("groupItemId é obrigatório para campo dentro de um grupo.");
    }

    await this.answers.upsert({
      organizationId: briefing.organizationId,
      briefingId: briefing.id,
      fieldId: field.id,
      groupItemId,
      groupItemOrder: input.groupItemOrder ?? null,
      valueText: input.valueText ?? null,
      valueJson: input.valueJson,
    });

    if (briefing.status === "PENDING") {
      await this.briefings.updateStatus(briefing.id, "IN_PROGRESS", { startedAt: new Date() });
      await this.briefings.addHistory(briefing.id, briefing.organizationId, "INICIADO", "PUBLIC_FORM");
    }

    await this.syncContactFields(briefing, field, sectionKey, input);
    await this.recalculateProgress(briefing.id, briefing.organizationId, briefing.template);

    return { ok: true };
  }

  async removeGroupItem(token: string, groupItemId: string) {
    const briefing = await this.loadByToken(token);
    this.assertEditable(briefing);
    await this.answers.removeGroupItem(briefing.id, briefing.organizationId, groupItemId);
    await this.recalculateProgress(briefing.id, briefing.organizationId, briefing.template);
    return { ok: true };
  }

  /** Seção "empresa": nome/email/whatsapp (ou telefone) alimentam Briefing.contact*. */
  private async syncContactFields(
    briefing: { id: string; organizationId: string },
    field: BriefingField,
    sectionKey: string,
    input: SaveAnswerInput,
  ) {
    if (sectionKey !== "empresa") return;
    const value = input.valueText?.trim();
    if (!value) return;
    if (field.key === "nome") {
      await this.briefings.updateContact(briefing.id, { contactName: value });
    } else if (field.key === "email") {
      await this.briefings.updateContact(briefing.id, { contactEmail: value });
    } else if (field.key === "whatsapp" || field.key === "telefone") {
      await this.briefings.updateContact(briefing.id, { contactPhone: value });
    }
  }

  private async recalculateProgress(
    briefingId: string,
    organizationId: string,
    template: BriefingTemplateDetail,
  ) {
    const answers = await this.answers.listForBriefing(briefingId, organizationId);
    const answeredFieldIds = new Set(answers.filter(answerHasValue).map((a) => a.fieldId));

    const topLevelFields = template.sections.flatMap((s) => s.fields);
    if (topLevelFields.length === 0) return;

    let answeredCount = 0;
    for (const field of topLevelFields) {
      const isAnswered =
        field.type === "GROUP"
          ? (field.children ?? []).some((child) => answeredFieldIds.has(child.id))
          : answeredFieldIds.has(field.id);
      if (isAnswered) answeredCount++;
    }

    const progressPercent = Math.round((answeredCount / topLevelFields.length) * 100);
    await this.briefings.updateProgress(briefingId, progressPercent);
  }
}

function findFieldById(
  template: BriefingTemplateDetail,
  fieldId: string,
): { field: BriefingField; sectionKey: string } | null {
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.id === fieldId) return { field, sectionKey: section.key };
      const child = field.children?.find((c) => c.id === fieldId);
      if (child) return { field: child, sectionKey: section.key };
    }
  }
  return null;
}
