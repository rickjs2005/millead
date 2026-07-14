import crypto from "node:crypto";
import type {
  ContractSignatureGateway,
  CriarDocumentoParams,
  DocumentoCriado,
  WebhookHeaders,
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

  verificarAssinatura(headers: WebhookHeaders, body: string): boolean {
    const secret = this.config.webhookSecret;
    if (!secret) {
      // Fail-closed: sem segredo, só aceita em dev + sandbox.
      return !this.config.isProduction && this.config.sandbox;
    }
    const raw = headers["x-zapsign-signature"];
    const assinatura = Array.isArray(raw) ? raw[0] : raw;
    if (!assinatura) return false;
    const esperado = crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (assinatura.length !== esperado.length) return false;
    return crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado));
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
