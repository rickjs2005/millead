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
    publicUrl: string | null;
  }): Promise<void>;

  /**
   * Aviso pro dono quando o cliente decide (aceita/recusa) pelo link
   * público -- best-effort, sem SMTP configurado vira no-op logado.
   */
  propostaDecidida(input: {
    titulo: string;
    valor: string;
    decision: "ACCEPTED" | "REJECTED";
    rejectReason: string | null;
    contractCreated: boolean;
    contractFailReason: string | null;
    proposalId: string;
  }): Promise<void>;
}
