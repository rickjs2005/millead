import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

let transporter: Transporter | null | undefined;

/** Cria o transporter só se SMTP_HOST estiver configurado; senão, e-mail é no-op. */
function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!env.SMTP_HOST) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/**
 * Envia e-mail se o SMTP estiver configurado; caso contrário, loga e segue
 * (o fluxo de contrato nunca falha por causa de e-mail).
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, "SMTP não configurado -- e-mail pulado");
    return false;
  }
  await t.sendMail({
    from: env.SMTP_FROM ?? env.SMTP_USER,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    attachments: opts.attachments,
  });
  return true;
}

export function emailConviteAssinatura(numero: string, nomeCliente: string, signUrl: string) {
  return {
    subject: `Assine seu contrato ${numero} — MilWeb`,
    html: `<p>Olá, ${nomeCliente}!</p>
      <p>Seu contrato <strong>${numero}</strong> com a MilWeb está pronto para assinatura eletrônica.</p>
      <p><a href="${signUrl}">Clique aqui para assinar o contrato</a></p>
      <p>Se o link acima não funcionar, copie e cole este endereço no navegador:<br>${signUrl}</p>
      <p>Qualquer dúvida, é só responder este e-mail.</p>
      <p>Equipe MilWeb</p>`,
  };
}

export function emailContratoAssinado(numero: string, nomeCliente: string) {
  return {
    subject: `✅ Contrato ${numero} assinado com sucesso`,
    html: `<p>Olá, ${nomeCliente}!</p>
      <p>Seu contrato <strong>${numero}</strong> foi assinado com sucesso por todas as partes.</p>
      <p>Uma cópia assinada segue em anexo. Em breve daremos início ao seu projeto.</p>
      <p>Equipe MilWeb</p>`,
  };
}

export function emailNotificacaoProprietario(numero: string, nomeCliente: string, valor: string) {
  return {
    subject: `🎉 Novo contrato assinado: ${numero}`,
    html: `<p>O contrato <strong>${numero}</strong> foi assinado.</p>
      <ul><li>Cliente: ${nomeCliente}</li><li>Valor: ${valor}</li></ul>
      <p>Acesse o painel para detalhes.</p>`,
  };
}
