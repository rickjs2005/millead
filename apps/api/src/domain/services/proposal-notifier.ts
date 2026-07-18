/**
 * Notificação de proposta enviada ao cliente. Best-effort: sem SMTP
 * configurado vira no-op logado, nunca quebra a transição de status.
 */
export interface ProposalNotifier {
  propostaEnviada(input: {
    titulo: string;
    valor: string;
    currency: string;
    validUntil: Date | null;
    nomeCliente: string;
    emailCliente: string;
    pdfUrl: string | null;
    nomeOrganizacao: string;
  }): Promise<void>;
}
