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

export interface ContractSignatureGateway {
  readonly nome: "MOCK" | "ZAPSIGN" | "CLICKSIGN" | "DOCUSIGN" | "AUTENTIQUE";
  criarDocumento(params: CriarDocumentoParams): Promise<DocumentoCriado>;
  /** Valida HMAC/segredo do webhook. Fail-closed em produção. */
  verificarAssinatura(headers: WebhookHeaders, body: string): boolean;
  interpretarWebhook(body: unknown): WebhookResultado;
}
