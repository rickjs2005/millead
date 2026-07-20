import type {
  BriefingAnswer,
  BriefingFile,
  BriefingTemplateDetail,
} from "../../domain/entities/briefing.js";
import type { BriefingRepository } from "../../domain/repositories/briefing-repository.js";
import type { BlobStorage } from "../../domain/services/blob-storage.js";
import type { BriefingNotifier } from "../../domain/services/briefing-notifier.js";

/** Dados que o renderizador de PDF espera (espelho do ContractPdfData). */
export interface BriefingPdfData {
  briefingTitle: string;
  templateName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  completedAt: string;
  template: BriefingTemplateDetail;
  answers: BriefingAnswer[];
  files: BriefingFile[];
}

export type BriefingPdfRenderer = (data: BriefingPdfData) => Promise<Buffer>;

const DATA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/**
 * Processa um briefing concluído de ponta a ponta: PDF -> Blob -> e-mail ->
 * WhatsApp. Rodado SOMENTE pelo worker BullMQ (interfaces/jobs). Idempotente
 * o bastante pra retry: se já tem pdfUrl, não gera de novo.
 */
export class BriefingProcessor {
  constructor(
    private readonly briefings: BriefingRepository,
    private readonly renderPdf: BriefingPdfRenderer,
    private readonly blob: BlobStorage,
    private readonly notifier: BriefingNotifier,
  ) {}

  async run(briefingId: string, organizationId: string): Promise<void> {
    const briefing = await this.briefings.findByIdForOrg(briefingId, organizationId);
    if (!briefing) throw new Error(`briefing ${briefingId} não encontrado`);
    if (briefing.status !== "COMPLETED") return; // nada a processar ainda

    const title = `${briefing.template.name} — ${briefing.contactName ?? "sem nome"}`;

    try {
      let pdfUrl = briefing.pdfUrl;
      let pdfBuffer: Buffer | null = null;

      if (!pdfUrl) {
        pdfBuffer = await this.renderPdf({
          briefingTitle: title,
          templateName: briefing.template.name,
          contactName: briefing.contactName,
          contactEmail: briefing.contactEmail,
          contactPhone: briefing.contactPhone,
          completedAt: DATA.format(briefing.completedAt ?? new Date()),
          template: briefing.template,
          answers: briefing.answers,
          files: briefing.files,
        });

        const uploaded = await this.blob.upload({
          pathname: `briefings/${organizationId}/${briefing.id}/briefing-${briefing.id}.pdf`,
          buffer: pdfBuffer,
          contentType: "application/pdf",
        });
        pdfUrl = uploaded.url;
        await this.briefings.setPdfUrl(briefing.id, pdfUrl);
        await this.briefings.addHistory(briefing.id, organizationId, "PDF_GERADO", "WORKER");
      }

      // best-effort: notificação nunca derruba o processamento
      try {
        await this.notifier.notificarConclusaoAdmin({
          briefingTitle: title,
          contactName: briefing.contactName,
          contactEmail: briefing.contactEmail,
          pdfUrl,
          pdfBuffer,
        });
        await this.briefings.addHistory(briefing.id, organizationId, "EMAIL_ENVIADO", "WORKER");
      } catch (err) {
        await this.briefings.addHistory(briefing.id, organizationId, "FALHA_EMAIL", "WORKER", {
          erro: err instanceof Error ? err.message : "desconhecido",
        });
      }

      if (briefing.contactPhone) {
        try {
          await this.notifier.notificarConclusaoWhatsapp({
            telefone: briefing.contactPhone,
            briefingTitle: title,
            contactName: briefing.contactName,
            pdfUrl,
          });
          await this.briefings.addHistory(
            briefing.id,
            organizationId,
            "WHATSAPP_ENVIADO",
            "WORKER",
          );
        } catch (err) {
          await this.briefings.addHistory(briefing.id, organizationId, "FALHA_WHATSAPP", "WORKER", {
            erro: err instanceof Error ? err.message : "desconhecido",
          });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha desconhecida.";
      await this.briefings.addHistory(
        briefing.id,
        organizationId,
        "FALHA_PROCESSAMENTO",
        "WORKER",
        {
          erro: message,
        },
      );
      throw err;
    }
  }
}
