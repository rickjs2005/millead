import { describe, expect, it } from "vitest";
import { falhouProcessamento } from "./contract-failure.js";

const evento = (tipo: string, hora: string) => ({
  tipo,
  createdAt: new Date(`2026-08-18T12:${hora}Z`),
});

describe("falhouProcessamento", () => {
  it("último evento é FALHA_PROCESSAMENTO: o worker parou numa falha", () => {
    expect(
      falhouProcessamento([evento("FALHA_PROCESSAMENTO", "31:36"), evento("PDF_GERADO", "31:31")]),
    ).toBe(true);
  });

  it("reprocessamento pedido depois da falha: voltou pra fila, não é mais falha", () => {
    expect(
      falhouProcessamento([
        evento("REPROCESSAMENTO", "40:00"),
        evento("FALHA_PROCESSAMENTO", "31:36"),
      ]),
    ).toBe(false);
  });

  it("decide pelo createdAt, não pela ordem em que os eventos chegaram", () => {
    expect(
      falhouProcessamento([evento("PDF_GERADO", "31:31"), evento("FALHA_PROCESSAMENTO", "31:36")]),
    ).toBe(true);
  });

  it("contrato recém-criado, sem eventos carregados: não falhou", () => {
    expect(falhouProcessamento([])).toBe(false);
  });
});
