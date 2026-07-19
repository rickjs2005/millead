// Porta do gateway de assinatura eletrônica (impl mock/ZapSign em
// infrastructure/contracts/signature).

export interface Signatario {
  nome: string;
  email: string;
  telefone?: string;
  papel?: string; // CONTRATANTE | CONTRATADA | TESTEMUNHA
}

export interface CriarDocumentoParams {
  nome: string;
  pdfBase64: string;
  signatarios: Signatario[];
  webhookUrl: string;
  metadata?: Record<string, string>;
}

export interface DocumentoCriado {
  docId: string;
  signUrl: string;
  raw: unknown;
}

export interface WebhookResultado {
  docId: string;
  evento: "VISUALIZADO" | "ASSINADO" | "RECUSADO" | "EXPIRADO" | "OUTRO";
  assinadoEm?: string;
  pdfAssinadoUrl?: string;
  raw: unknown;
}

/** Headers HTTP no formato do Express (req.headers). */
export type WebhookHeaders = Record<string, string | string[] | undefined>;

export interface ConfirmacaoAssinatura {
  assinado: boolean;
  /** URL do PDF assinado vinda da API do provedor (autoritativa, não do corpo do webhook). */
  pdfAssinadoUrl?: string;
  assinadoEm?: string;
}

export interface ContractSignatureGateway {
  readonly nome: "MOCK" | "ZAPSIGN" | "CLICKSIGN" | "DOCUSIGN" | "AUTENTIQUE";
  criarDocumento(params: CriarDocumentoParams): Promise<DocumentoCriado>;
  /**
   * 1ª camada: valida a autenticidade do webhook (HMAC ou header secreto,
   * conforme o provedor). Síncrono, fail-closed em produção.
   */
  verificarAssinatura(headers: WebhookHeaders, body: string): boolean;
  interpretarWebhook(body: unknown): WebhookResultado;
  /**
   * Reconsulta o status REAL do documento na API do provedor antes de marcar
   * como assinado -- um webhook "assinado" forjado não sobrevive a isto, e a
   * URL do PDF assinado vem daqui (autoritativa), não do corpo do webhook.
   * Deve LANÇAR em erro de rede (pra o provedor reenviar depois). Gateways sem
   * API externa (mock) confiam no próprio evento.
   *
   * Para o ZapSign esta é a ÚNICA camada de autenticidade: os planos básicos
   * não assinam o webhook nem permitem header customizado, então
   * `verificarAssinatura` aceita e a segurança vem 100% daqui + rate-limit.
   */
  confirmarAssinado(docId: string): Promise<ConfirmacaoAssinatura>;
}
