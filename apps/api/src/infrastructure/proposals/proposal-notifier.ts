import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { ProposalNotifier } from "../../domain/services/proposal-notifier.js";
import { sendEmail } from "../contracts/notifications/mailer.js";
import { escapeHtml } from "./html-escape.js";

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
    publicUrl: string | null;
  }): Promise<void> {
    try {
      const validade = input.validUntil
        ? `<p>Validade da proposta: <strong>${input.validUntil.toLocaleDateString("pt-BR")}</strong></p>`
        : "";
      const pdf = input.pdfUrl
        ? `<p><a href="${input.pdfUrl}">Abrir a proposta completa (PDF)</a></p>`
        : "";
      const aceite = input.publicUrl
        ? `<p><a href="${input.publicUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Ver e aceitar a proposta</a></p>`
        : "";
      await sendEmail({
        to: input.emailCliente,
        subject: `Proposta: ${input.titulo} — ${input.nomeOrganizacao}`,
        html: `
          <p>Olá, ${input.nomeCliente}!</p>
          <p>Segue a proposta <strong>${input.titulo}</strong> no valor de
          <strong>${formatValor(input.valor, input.currency)}</strong>.</p>
          ${validade}
          ${aceite}
          ${pdf}
          <p>Qualquer dúvida, é só responder este e-mail.</p>
          <p>— ${input.nomeOrganizacao}</p>
        `,
      });
    } catch (err) {
      logger.error({ err, titulo: input.titulo }, "falha no e-mail de proposta (ignorada)");
    }
  }

  async propostaDecidida(input: {
    titulo: string;
    valor: string;
    decision: "ACCEPTED" | "REJECTED";
    rejectReason: string | null;
    contractCreated: boolean;
    contractFailReason: string | null;
    proposalId: string;
  }): Promise<void> {
    if (!env.OWNER_EMAIL) {
      logger.info(
        { proposalId: input.proposalId },
        "OWNER_EMAIL não configurado -- notificação de decisão pulada",
      );
      return;
    }
    try {
      const aceite = input.decision === "ACCEPTED";
      // rejectReason e titulo vêm do formulário público (input livre,
      // anônimo, sem autenticação) -- escapados ANTES de entrar no HTML do
      // e-mail do dono, pra um "motivo" tipo `<a href=...>` não virar link
      // clicável/markup de verdade na caixa de entrada dele.
      const tituloSeguro = escapeHtml(input.titulo);
      const motivo = input.rejectReason
        ? `<p>Motivo informado: ${escapeHtml(input.rejectReason)}</p>`
        : "";
      const contratoInfo = aceite
        ? input.contractCreated
          ? "<p>Um contrato rascunho já foi criado automaticamente a partir da proposta.</p>"
          : `<p>⚠️ Não foi possível criar o contrato automaticamente${
              input.contractFailReason ? `: ${escapeHtml(input.contractFailReason)}` : ""
            }. Verifique os dados do lead e crie manualmente.</p>`
        : "";
      await sendEmail({
        to: env.OWNER_EMAIL,
        subject: aceite
          ? `✅ Proposta aceita: ${input.titulo}`
          : `❌ Proposta recusada: ${input.titulo}`,
        html: `
          <p>A proposta <strong>${tituloSeguro}</strong> (valor ${input.valor}) foi
          <strong>${aceite ? "aceita" : "recusada"}</strong> pelo cliente pelo link público.</p>
          ${motivo}
          ${contratoInfo}
        `,
      });
    } catch (err) {
      logger.error(
        { err, proposalId: input.proposalId },
        "falha no e-mail de decisão da proposta (ignorada)",
      );
    }
  }
}
