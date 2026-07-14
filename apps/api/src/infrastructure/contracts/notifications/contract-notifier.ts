import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";
import type { ContractNotifier } from "../../../domain/services/contract-notifier.js";
import {
  emailContratoAssinado,
  emailConviteAssinatura,
  emailNotificacaoProprietario,
  sendEmail,
} from "./mailer.js";
import { enviarWhatsApp } from "./whatsapp.js";

export class DefaultContractNotifier implements ContractNotifier {
  async conviteAssinatura(input: {
    numero: string;
    nomeCliente: string;
    emailCliente: string;
    signUrl: string;
  }): Promise<void> {
    try {
      const { subject, html } = emailConviteAssinatura(
        input.numero,
        input.nomeCliente,
        input.signUrl,
      );
      await sendEmail({ to: input.emailCliente, subject, html });
    } catch (err) {
      logger.error({ err, numero: input.numero }, "falha no convite de assinatura (ignorada)");
    }
  }

  async contratoAssinado(input: {
    numero: string;
    nomeCliente: string;
    emailCliente: string;
    telefoneCliente?: string | null;
    valorFormatado: string;
    pdfAssinado?: Buffer | null;
  }): Promise<void> {
    try {
      const cliente = emailContratoAssinado(input.numero, input.nomeCliente);
      await sendEmail({
        to: input.emailCliente,
        subject: cliente.subject,
        html: cliente.html,
        attachments: input.pdfAssinado
          ? [{ filename: `${input.numero}-assinado.pdf`, content: input.pdfAssinado }]
          : undefined,
      });
      if (env.OWNER_EMAIL) {
        const dono = emailNotificacaoProprietario(
          input.numero,
          input.nomeCliente,
          input.valorFormatado,
        );
        await sendEmail({ to: env.OWNER_EMAIL, subject: dono.subject, html: dono.html });
      }
      if (input.telefoneCliente) {
        await enviarWhatsApp(
          input.telefoneCliente,
          `✅ Seu contrato ${input.numero} com a MilWeb foi assinado com sucesso! Em breve entraremos em contato para dar início ao projeto.`,
        );
      }
    } catch (err) {
      logger.error({ err, numero: input.numero }, "falha na notificação de assinado (ignorada)");
    }
  }
}
