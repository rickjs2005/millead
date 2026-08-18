import { describe, expect, it } from "vitest";
import { contractProgress, mensagemDaFalha } from "./contract-progress";

describe("contractProgress", () => {
  it("PDF gerado e nenhuma falha: o worker ainda está trabalhando", () => {
    expect(contractProgress({ status: "PDF_GERADO", falhouProcessamento: false })).toBe(
      "processando",
    );
  });

  it("PDF gerado com falha no último evento: é o contrato que girava pra sempre", () => {
    expect(contractProgress({ status: "PDF_GERADO", falhouProcessamento: true })).toBe("falhou");
  });

  it("aguardando assinatura: não há worker pra esperar", () => {
    expect(contractProgress({ status: "AGUARDANDO_ASSINATURA", falhouProcessamento: false })).toBe(
      "finalizado",
    );
  });

  it("falha antiga num contrato que acabou assinando não vira erro na tela", () => {
    expect(contractProgress({ status: "ASSINADO", falhouProcessamento: true })).toBe("finalizado");
  });

  it("rascunho herdado de proposta (nunca enfileirado) segue como processando", () => {
    expect(contractProgress({ status: "RASCUNHO", falhouProcessamento: false })).toBe(
      "processando",
    );
  });
});

const evento = (tipo: string, hora: string, payload: unknown = null) => ({
  tipo,
  payload,
  createdAt: `2026-08-18T12:${hora}Z`,
});

describe("mensagemDaFalha", () => {
  it("mostra o motivo que o worker gravou (é o que diz o que fazer)", () => {
    expect(
      mensagemDaFalha([
        evento("FALHA_PROCESSAMENTO", "31:36", { erro: "ZapSign criarDocumento falhou: 402" }),
        evento("PDF_GERADO", "31:31"),
      ]),
    ).toBe("ZapSign criarDocumento falhou: 402");
  });

  it("pega a falha mais recente quando houve mais de uma tentativa", () => {
    expect(
      mensagemDaFalha([
        evento("FALHA_PROCESSAMENTO", "40:00", { erro: "segunda tentativa" }),
        evento("FALHA_PROCESSAMENTO", "31:36", { erro: "primeira tentativa" }),
      ]),
    ).toBe("segunda tentativa");
  });

  it("falha sem payload legível não inventa mensagem", () => {
    expect(mensagemDaFalha([evento("FALHA_PROCESSAMENTO", "31:36")])).toBeNull();
  });

  it("sem falha nenhuma, não há mensagem", () => {
    expect(mensagemDaFalha([evento("PDF_GERADO", "31:31")])).toBeNull();
  });
});
