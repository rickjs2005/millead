import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";
import type { BriefingNotifier } from "../../../domain/services/briefing-notifier.js";
// Reaproveitados de contracts/notifications -- sendEmail/enviarWhatsApp são
// utilitários genéricos (SMTP/Meta Cloud API), não específicos de contrato;
// só os TEMPLATES de contrato ficam lá, e não os usamos aqui.
import { sendEmail } from "../../contracts/notifications/mailer.js";
import { enviarWhatsApp } from "../../contracts/notifications/whatsapp.js";

function emailConclusaoAdmin(briefingTitle: string, contactName?: string | null, pdfUrl?: string) {
  return {
    subject: `📋 Briefing concluído: ${briefingTitle}`,
    html: `<p>O briefing <strong>${briefingTitle}</strong> foi concluído${contactName ? ` por ${contactName}` : ""}.</p>
      ${pdfUrl ? `<p><a href="${pdfUrl}">Baixar PDF do briefing</a></p>` : ""}
      <p>Acesse o painel do MilLead para ver todas as respostas.</p>`,
  };
}

export class DefaultBriefingNotifier implements BriefingNotifier {
  async notificarConclusaoAdmin(input: {
    briefingTitle: string;
    contactName?: string | null;
    contactEmail?: string | null;
    pdfUrl: string;
    pdfBuffer?: Buffer | null;
  }): Promise<void> {
    if (!env.OWNER_EMAIL) {
      logger.info(
        { briefingTitle: input.briefingTitle },
        "OWNER_EMAIL não configurado -- notificação pulada",
      );
      return;
    }
    const { subject, html } = emailConclusaoAdmin(
      input.briefingTitle,
      input.contactName,
      input.pdfUrl,
    );
    await sendEmail({
      to: env.OWNER_EMAIL,
      subject,
      html,
      attachments: input.pdfBuffer
        ? [{ filename: `${input.briefingTitle}.pdf`, content: input.pdfBuffer }]
        : undefined,
    });
  }

  async notificarConclusaoWhatsapp(input: {
    telefone: string;
    briefingTitle: string;
    contactName?: string | null;
    pdfUrl: string;
  }): Promise<void> {
    const quem = input.contactName ? `de ${input.contactName}` : "";
    await enviarWhatsApp(
      input.telefone,
      `✅ Briefing "${input.briefingTitle}" ${quem} concluído! PDF completo: ${input.pdfUrl}`,
    );
  }
}
