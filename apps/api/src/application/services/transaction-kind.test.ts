import { describe, expect, it } from "vitest";
import { findTransferPairs, guessKind, type TransferLeg } from "./transaction-kind.js";
import { utcDate } from "./vault-date.js";

describe("o TRNTYPE do banco ganha de tudo", () => {
  it("é o próprio banco classificando a movimentação", () => {
    expect(guessKind("QUALQUER COISA", "XFER")).toMatchObject({
      kind: "TRANSFERENCIA",
      neutral: true,
      confidence: "alta",
    });
    expect(guessKind("SAQUE 24H", "ATM").kind).toBe("SAQUE");
    expect(guessKind("TARIFA MENSAL", "FEE").kind).toBe("TARIFA");
  });

  it("DEBIT e CREDIT são genéricos demais e caem no texto", () => {
    // Eles só repetem o sinal, que já veio no valor.
    expect(guessKind("PAGAMENTO DE FATURA CARTAO", "DEBIT").kind).toBe("PAGAMENTO_FATURA");
  });
});

describe("o que NÃO é despesa nem receita", () => {
  it("pagamento de fatura é neutro — a despesa foi a compra", () => {
    const r = guessKind("PAGAMENTO DE FATURA CARTAO FINAL 1234");
    expect(r.kind).toBe("PAGAMENTO_FATURA");
    expect(r.neutral).toBe(true);
  });

  it("estorno é neutro — desfaz, não é renda", () => {
    expect(guessKind("ESTORNO DE COMPRA").neutral).toBe(true);
    expect(guessKind("REEMBOLSO PARCIAL").neutral).toBe(true);
  });

  it("transferência entre contas próprias é neutra", () => {
    expect(guessKind("TRANSFERENCIA ENTRE CONTAS").neutral).toBe(true);
    expect(guessKind("APLICACAO AUTOMATICA").neutral).toBe(true);
  });

  it("mas tarifa e juros SÃO despesa", () => {
    // Dinheiro que saiu e não volta.
    expect(guessKind("TARIFA MENSAL").neutral).toBe(false);
    expect(guessKind("JUROS DO CHEQUE ESPECIAL").neutral).toBe(false);
  });
});

describe("Pix e TED — sinal, não certeza", () => {
  it("são reconhecidos, mas com confiança média e NÃO neutros", () => {
    // Pode ser transferência entre suas contas ou pagamento a fornecedor, e a
    // diferença muda se conta como despesa. Marcar neutro por padrão faria
    // todo Pix pago sumir do total de gastos.
    const r = guessKind("PIX ENVIADO JOAO SILVA");
    expect(r.kind).toBe("TRANSFERENCIA");
    expect(r.confidence).toBe("media");
    expect(r.neutral).toBe(false);
  });
});

describe("compra comum", () => {
  it("é o padrão quando nada mais casa", () => {
    const r = guessKind("MERCADO BOM PRECO");
    expect(r).toMatchObject({ kind: "COMPRA", neutral: false, matched: null });
  });
});

describe("achar as duas pernas de uma transferência", () => {
  const leg = (over: Partial<TransferLeg>): TransferLeg => ({
    id: "x",
    accountId: "acc-1",
    cardId: null,
    direction: "OUT",
    amountCents: 90000,
    date: utcDate(2026, 8, 10),
    ...over,
  });

  it("casa saída e entrada de mesmo valor em contas diferentes", () => {
    const pares = findTransferPairs([
      leg({ id: "saida", accountId: "acc-1", direction: "OUT" }),
      leg({ id: "entrada", accountId: "acc-2", direction: "IN" }),
    ]);
    expect(pares).toEqual([["saida", "entrada"]]);
  });

  it("aceita até três dias de diferença — entre bancos, cai no dia seguinte", () => {
    const pares = findTransferPairs([
      leg({ id: "s", accountId: "acc-1", date: utcDate(2026, 8, 10) }),
      leg({ id: "e", accountId: "acc-2", direction: "IN", date: utcDate(2026, 8, 12) }),
    ]);
    expect(pares).toHaveLength(1);
  });

  it("não casa além da janela", () => {
    const pares = findTransferPairs([
      leg({ id: "s", accountId: "acc-1", date: utcDate(2026, 8, 1) }),
      leg({ id: "e", accountId: "acc-2", direction: "IN", date: utcDate(2026, 8, 20) }),
    ]);
    expect(pares).toEqual([]);
  });

  it("não casa valores diferentes", () => {
    const pares = findTransferPairs([
      leg({ id: "s", accountId: "acc-1", amountCents: 90000 }),
      leg({ id: "e", accountId: "acc-2", direction: "IN", amountCents: 90001 }),
    ]);
    expect(pares).toEqual([]);
  });

  it("não casa dentro da MESMA conta", () => {
    // Sair e entrar na mesma conta é erro de lançamento, não transferência.
    const pares = findTransferPairs([
      leg({ id: "s", accountId: "acc-1" }),
      leg({ id: "e", accountId: "acc-1", direction: "IN" }),
    ]);
    expect(pares).toEqual([]);
  });

  it("cada perna entra num par só", () => {
    // Duas saídas iguais e uma entrada: só uma casa, senão a mesma entrada
    // zeraria duas saídas e o saldo sumiria.
    const pares = findTransferPairs([
      leg({ id: "s1", accountId: "acc-1" }),
      leg({ id: "s2", accountId: "acc-1" }),
      leg({ id: "e1", accountId: "acc-2", direction: "IN" }),
    ]);
    expect(pares).toHaveLength(1);
  });
});
