import type {
  ConfirmacaoAssinatura,
  ContractSignatureGateway,
  CriarDocumentoParams,
  DocumentoCriado,
  WebhookResultado,
} from "../../../domain/services/contract-signature.js";

const BASE = "https://api.zapsign.com.br/api/v1";

export interface ZapSignConfig {
  apiToken: string;
  webhookSecret?: string;
  /** true = API de teste da ZapSign (sem validade jurídica, sem plano pago). */
  sandbox: boolean;
  sendWhatsapp: boolean;
  isProduction: boolean;
}

/** Implementação ZapSign (docs: https://docs.zapsign.com.br/). */
export class ZapSignGateway implements ContractSignatureGateway {
  readonly nome = "ZAPSIGN" as const;

  constructor(private readonly config: ZapSignConfig) {}

  async criarDocumento(params: CriarDocumentoParams): Promise<DocumentoCriado> {
    const res = await fetch(`${BASE}/docs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiToken}`,
      },
      body: JSON.stringify({
        name: params.nome,
        base64_pdf: params.pdfBase64,
        external_id: params.metadata?.contractId,
        sandbox: this.config.sandbox,
        signers: params.signatarios.map((s) => {
          const phone = s.telefone?.replace(/\D/g, "");
          const whatsapp = this.config.sendWhatsapp && Boolean(phone);
          return {
            name: s.nome,
            email: s.email,
            phone_country: whatsapp ? "55" : undefined,
            phone_number: whatsapp ? phone : undefined,
            send_automatic_email: true,
            send_automatic_whatsapp: whatsapp,
            auth_mode: "assinaturaTela",
          };
        }),
      }),
    });

    if (!res.ok) {
      throw new Error(`ZapSign criarDocumento falhou: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { token: string; signers: { sign_url: string }[] };
    return { docId: data.token, signUrl: data.signers?.[0]?.sign_url ?? "", raw: data };
  }

  /**
   * O ZapSign (planos básicos) NÃO assina o webhook nem permite header
   * customizado -- confirmado no painel. Então NÃO dá pra validar a
   * autenticidade aqui: aceitamos, e a segurança do evento crítico (ASSINADO)
   * vem 100% da 2ª camada (`confirmarAssinado`, que reconsulta a API do ZapSign)
   * somada ao rate-limit da rota. Se um dia o plano permitir header, dá pra
   * reintroduzir a validação por `Authorization: Bearer <segredo>` aqui.
   */
  verificarAssinatura(): boolean {
    return true;
  }

  /**
   * Reconsulta o documento na API do ZapSign: confirma se está mesmo assinado
   * e devolve a URL AUTORITATIVA do PDF assinado (não a do corpo do webhook,
   * que é falsificável). Lança em erro de rede (o ZapSign reenvia depois);
   * `assinado:false` só quando a API diz, definitivamente, que não está
   * assinado -- o que derruba um webhook forjado.
   */
  async confirmarAssinado(docId: string): Promise<ConfirmacaoAssinatura> {
    const res = await fetch(`${BASE}/docs/${docId}/`, {
      headers: { Authorization: `Bearer ${this.config.apiToken}` },
    });
    if (!res.ok) {
      throw new Error(`ZapSign reconsulta do documento falhou: ${res.status}`);
    }
    const data = (await res.json()) as { status?: string; signed_file?: string };
    return { assinado: data.status === "signed", pdfAssinadoUrl: data.signed_file };
  }

  interpretarWebhook(body: unknown): WebhookResultado {
    const b = body as {
      token?: string;
      status?: string;
      signed_file?: string;
      event_type?: string;
    };
    const map: Record<string, WebhookResultado["evento"]> = {
      doc_signed: "ASSINADO",
      doc_viewed: "VISUALIZADO",
      doc_refused: "RECUSADO",
      doc_deleted: "OUTRO",
    };
    return {
      docId: b.token ?? "",
      evento: map[b.event_type ?? ""] ?? "OUTRO",
      assinadoEm: b.status === "signed" ? new Date().toISOString() : undefined,
      pdfAssinadoUrl: b.signed_file,
      raw: body,
    };
  }
}
