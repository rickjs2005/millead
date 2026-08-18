import { afterEach, describe, expect, it, vi } from "vitest";
import { ZapSignGateway } from "./zapsign.js";

function gateway(sandbox: boolean) {
  return new ZapSignGateway({
    apiToken: "token-de-teste",
    sandbox,
    sendWhatsapp: false,
    isProduction: false,
  });
}

/** Captura as URLs chamadas e devolve sempre a mesma resposta feliz. */
function espionarFetch(body: unknown): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(String(url));
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return urls;
}

const DOC_CRIADO = { token: "doc-1", signers: [{ sign_url: "https://assina.aqui/1" }] };

afterEach(() => vi.unstubAllGlobals());

describe("ZapSignGateway", () => {
  it("sandbox usa o host de testes -- é a URL que troca de ambiente", async () => {
    const urls = espionarFetch(DOC_CRIADO);
    await gateway(true).criarDocumento({
      nome: "Contrato X",
      pdfBase64: "JVBERi0=",
      signatarios: [{ nome: "Fulano", email: "f@exemplo.com", papel: "CONTRATANTE" }],
      webhookUrl: "https://api.exemplo.com/webhook",
    });
    expect(urls).toEqual(["https://sandbox.api.zapsign.com.br/api/v1/docs/"]);
  });

  it("sem sandbox usa o host de produção", async () => {
    const urls = espionarFetch(DOC_CRIADO);
    await gateway(false).criarDocumento({
      nome: "Contrato X",
      pdfBase64: "JVBERi0=",
      signatarios: [{ nome: "Fulano", email: "f@exemplo.com", papel: "CONTRATANTE" }],
      webhookUrl: "https://api.exemplo.com/webhook",
    });
    expect(urls).toEqual(["https://api.zapsign.com.br/api/v1/docs/"]);
  });

  it("a reconsulta do documento fica no mesmo ambiente da criação", async () => {
    const urls = espionarFetch({ status: "signed", signed_file: "https://arquivo/1.pdf" });
    await gateway(true).confirmarAssinado("doc-1");
    expect(urls).toEqual(["https://sandbox.api.zapsign.com.br/api/v1/docs/doc-1/"]);
  });
});
