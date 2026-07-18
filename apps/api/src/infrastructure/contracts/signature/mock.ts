import type {
  ContractSignatureGateway,
  CriarDocumentoParams,
  DocumentoCriado,
  WebhookResultado,
} from "../../../domain/services/contract-signature.js";

/**
 * Provedor de assinatura SIMULADO -- padrão enquanto nenhum provedor real
 * (ZapSign etc.) está configurado. Não chama API externa: cria um docId
 * falso e aceita webhooks de teste (POST no endpoint com {docId, evento}).
 *
 * `failClosed` (ligado em produção): faz `verificarAssinatura` recusar,
 * porque em produção aceitar webhook sem HMAC deixaria forjar "contrato
 * assinado" só sabendo o id do contrato.
 */
export class MockSignatureGateway implements ContractSignatureGateway {
  readonly nome = "MOCK" as const;

  constructor(private readonly failClosed = false) {}

  async criarDocumento(params: CriarDocumentoParams): Promise<DocumentoCriado> {
    const fakeId = `mock-${params.metadata?.contractId ?? "doc"}`;
    return {
      docId: fakeId,
      signUrl: `https://assinatura.exemplo.local/sign/${fakeId}`,
      raw: { mock: true, signatarios: params.signatarios.length },
    };
  }

  verificarAssinatura(): boolean {
    // Em prod recusa (não há HMAC pra validar); em dev aceita p/ testes.
    return !this.failClosed;
  }

  interpretarWebhook(body: unknown): WebhookResultado {
    const b = body as { docId?: string; evento?: WebhookResultado["evento"] };
    return {
      docId: b.docId ?? "",
      evento: b.evento ?? "ASSINADO",
      assinadoEm: new Date().toISOString(),
      raw: body,
    };
  }
}
