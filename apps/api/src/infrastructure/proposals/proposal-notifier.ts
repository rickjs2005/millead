import { logger } from "../../config/logger.js";
import type { ProposalNotifier } from "../../domain/services/proposal-notifier.js";
import { sendEmail } from "../contracts/notifications/mailer.js";

function formatValor(valor: string, currency: string): string {
  const n = Number(valor);
  if (Number.isNaN(n)) return valor;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

/** E-mail simples de proposta -- reusa o mailer dos contratos (no-op sem SMTP). */
export class DefaultProposalNotifier implements ProposalNotifier {
  async propostaEnviada(input: {
    titulo: string;
    valor: string;
    currency: string;
    validUntil: Date | null;
    nomeCliente: string;
    emailCliente: string;
    pdfUrl: string | null;
    nomeOrganizacao: string;
  }): Promise<void> {
    try {
      const validade = input.validUntil
        ? `<p>Validade da proposta: <strong>${input.validUntil.toLocaleDateString("pt-BR")}</strong></p>`
        : "";
      const pdf = input.pdfUrl
        ? `<p><a href="${input.pdfUrl}">Abrir a proposta completa (PDF)</a></p>`
        : "";
      await sendEmail({
        to: input.emailCliente,
        subject: `Proposta: ${input.titulo} — ${input.nomeOrganizacao}`,
        html: `
          <p>Olá, ${input.nomeCliente}!</p>
          <p>Segue a proposta <strong>${input.titulo}</strong> no valor de
          <strong>${formatValor(input.valor, input.currency)}</strong>.</p>
          ${validade}
          ${pdf}
          <p>Qualquer dúvida, é só responder este e-mail.</p>
          <p>— ${input.nomeOrganizacao}</p>
        `,
      });
    } catch (err) {
      logger.error({ err, titulo: input.titulo }, "falha no e-mail de proposta (ignorada)");
    }
  }
}
