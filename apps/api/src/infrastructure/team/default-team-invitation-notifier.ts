import { logger } from "../../config/logger.js";
import type { TeamInvitationNotifier } from "../../domain/services/team-invitation-notifier.js";
import { sendEmail } from "../contracts/notifications/mailer.js";
import { escapeHtml } from "../proposals/html-escape.js";

export class DefaultTeamInvitationNotifier implements TeamInvitationNotifier {
  async send(input: {
    to: string;
    organizationName: string;
    inviterName: string;
    roleName: string;
    inviteUrl: string;
    expiresAt: Date;
  }): Promise<boolean> {
    try {
      const organization = escapeHtml(input.organizationName);
      const inviter = escapeHtml(input.inviterName);
      const role = escapeHtml(input.roleName);
      const url = escapeHtml(input.inviteUrl);
      return await sendEmail({
        to: input.to,
        subject: `Convite para acessar ${input.organizationName} no MilLead`,
        html: `<p>Olá!</p>
          <p><strong>${inviter}</strong> convidou você para participar de <strong>${organization}</strong> no MilLead com o papel <strong>${role}</strong>.</p>
          <p><a href="${url}">Aceitar convite</a></p>
          <p>Este link expira em 7 dias. Se o botão não funcionar, copie e cole:<br>${url}</p>`,
      });
    } catch (error) {
      logger.warn({ err: error, to: input.to }, "falha ao enviar convite de equipe");
      return false;
    }
  }
}
