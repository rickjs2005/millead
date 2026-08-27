import { Prisma } from "@millead/database";
import { describe, expect, it } from "vitest";
import { normalizeDecimals } from "./prisma-personal-backup-repository.js";

/**
 * Este arquivo existe por causa de um bug que só apareceu executando: a
 * planilha respondia 500 enquanto o JSON, do MESMO dump, saía normalmente.
 *
 * A causa: o Prisma devolve `Decimal`, e `JSON.stringify` chama o `toJSON()`
 * dele sozinho -- então o formato JSON escondia o problema, e o CSV, que faz
 * `.replace()` na string, estourava.
 */
describe("normalizeDecimals", () => {
  it("converte Decimal em string com duas casas", () => {
    const saida = normalizeDecimals({ amount: new Prisma.Decimal("100.00") });
    expect(saida.amount).toBe("100.00");
  });

  it("não corta zero à direita — 100.00 não vira 100", () => {
    // O `toJSON()` do Decimal corta, e o arquivo mostraria "R$ 100" onde o
    // resto do sistema mostra "R$ 100,00". O mesmo problema da fase 7, agora
    // num arquivo que a pessoa guarda por anos.
    const cru = new Prisma.Decimal("100.00");
    expect(JSON.stringify(cru)).toBe('"100"');
    expect(normalizeDecimals(cru)).toBe("100.00");
  });

  it("desce em objetos e listas aninhadas", () => {
    const saida = normalizeDecimals({
      transactions: [
        {
          id: "tx-1",
          amountBrl: new Prisma.Decimal("300.5"),
          splits: [{ amount: new Prisma.Decimal("100") }],
        },
      ],
    });
    expect(saida.transactions[0]!.amountBrl).toBe("300.50");
    expect(saida.transactions[0]!.splits[0]!.amount).toBe("100.00");
  });

  it("não estraga data, texto, número, booleano nem nulo", () => {
    const data = new Date("2026-08-05T00:00:00.000Z");
    const saida = normalizeDecimals({
      data,
      texto: "ANTHROPIC",
      numero: 7,
      booleano: true,
      nulo: null,
    });
    // Data tem de continuar Date: o restore a devolve ao Prisma, que recusa
    // string onde espera DateTime.
    expect(saida.data).toBeInstanceOf(Date);
    expect(saida.data).toBe(data);
    expect(saida.texto).toBe("ANTHROPIC");
    expect(saida.numero).toBe(7);
    expect(saida.booleano).toBe(true);
    expect(saida.nulo).toBeNull();
  });
});
