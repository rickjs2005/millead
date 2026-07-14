/**
 * Porta de notificações do fluxo de contratos (e-mail/WhatsApp). A
 * implementação é best-effort: sem SMTP/WhatsApp configurados vira no-op --
 * o fluxo de contrato NUNCA falha por causa de notificação.
 */
export interface ContractNotifier {
  conviteAssinatura(input: {
    numero: string;
    nomeCliente: string;
    emailCliente: string;
    signUrl: string;
  }): Promise<void>;

  contratoAssinado(input: {
    numero: string;
    nomeCliente: string;
    emailCliente: string;
    telefoneCliente?: string | null;
    valorFormatado: string;
    pdfAssinado?: Buffer | null;
  }): Promise<void>;
}
