/**
 * Porta de notificações do fluxo de briefing (e-mail/WhatsApp). Best-effort,
 * igual ContractNotifier: sem SMTP/WhatsApp configurados vira no-op -- a
 * conclusão de um briefing NUNCA falha por causa de notificação.
 */
export interface BriefingNotifier {
  /** Ao admin/owner: PDF anexado com o briefing completo. */
  notificarConclusaoAdmin(input: {
    briefingTitle: string;
    contactName?: string | null;
    contactEmail?: string | null;
    pdfUrl: string;
    pdfBuffer?: Buffer | null;
  }): Promise<void>;

  /** Resumo em texto pro WhatsApp do responsável (Cloud API não manda mídia hoje). */
  notificarConclusaoWhatsapp(input: {
    telefone: string;
    briefingTitle: string;
    contactName?: string | null;
    pdfUrl: string;
  }): Promise<void>;
}
