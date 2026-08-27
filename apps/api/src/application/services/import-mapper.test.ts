import { describe, expect, it } from "vitest";
import { mapCsvRows, mapOfxTransactions, type ImportProfileSettings } from "./import-mapper.js";
import { parseCsv } from "./import-csv.js";
import { parseOfx } from "./import-ofx.js";
import { formatUtcDate } from "./vault-date.js";

const perfilBr: ImportProfileSettings = {
  delimiter: ";",
  decimalSeparator: ",",
  dateOrder: "DMY",
  hasHeader: true,
  invertSign: false,
  columnMap: { date: "Data", description: "Histórico", amount: "Valor" },
};

const CSV_BR = `Data;Histórico;Valor
27/08/2026;MERCADO SAO JOAO;-1.234,56
28/08/2026;SALARIO;2.500,00
29/08/2026;IFOOD *IFD;-45,90`;

describe("mapCsvRows — mapeamento por nome de coluna", () => {
  it("converte o extrato inteiro", () => {
    const rows = mapCsvRows(parseCsv(CSV_BR, ";"), perfilBr);
    expect(rows).toHaveLength(3);

    expect(rows[0]).toMatchObject({
      line: 2, // linha 1 é o cabeçalho
      description: "MERCADO SAO JOAO",
      amountCents: 123456,
      direction: "OUT",
      errors: [],
    });
    expect(formatUtcDate(rows[0]!.date!)).toBe("2026-08-27");
  });

  it("valor positivo vira entrada", () => {
    const rows = mapCsvRows(parseCsv(CSV_BR, ";"), perfilBr);
    expect(rows[1]).toMatchObject({ direction: "IN", amountCents: 250000 });
  });

  it("invertSign troca o sentido — há banco que manda despesa positiva", () => {
    const rows = mapCsvRows(parseCsv(CSV_BR, ";"), { ...perfilBr, invertSign: true });
    expect(rows[0]!.direction).toBe("IN");
    expect(rows[1]!.direction).toBe("OUT");
  });
});

describe("mapCsvRows — mapeamento por índice e colunas separadas", () => {
  it("aceita índice numérico quando o CSV não tem cabeçalho", () => {
    const csv = "27/08/2026;MERCADO;-120,00";
    const rows = mapCsvRows(parseCsv(csv, ";"), {
      ...perfilBr,
      hasHeader: false,
      columnMap: { date: 0, description: 1, amount: 2 },
    });
    expect(rows[0]).toMatchObject({ line: 1, description: "MERCADO", direction: "OUT" });
  });

  it("aceita débito e crédito em colunas separadas", () => {
    // Formato comum em extrato de conta corrente: uma coluna pra cada lado,
    // sem sinal nenhum.
    const csv =
      "Data;Descricao;Debito;Credito\n27/08/2026;MERCADO;120,00;\n28/08/2026;SALARIO;;2.500,00";
    const rows = mapCsvRows(parseCsv(csv, ";"), {
      ...perfilBr,
      columnMap: { date: "Data", description: "Descricao", debit: "Debito", credit: "Credito" },
    });

    expect(rows[0]).toMatchObject({ direction: "OUT", amountCents: 12000 });
    expect(rows[1]).toMatchObject({ direction: "IN", amountCents: 250000 });
  });

  it("lê o identificador externo quando a coluna existe", () => {
    const csv = "Data;Descricao;Valor;Id\n27/08/2026;MERCADO;-120,00;TX-9";
    const rows = mapCsvRows(parseCsv(csv, ";"), {
      ...perfilBr,
      columnMap: { ...perfilBr.columnMap, externalId: "Id" },
    });
    expect(rows[0]!.externalId).toBe("TX-9");
  });
});

describe("mapCsvRows — linha ruim vira erro, não chute", () => {
  it("acusa data ilegível, valor ilegível e descrição vazia", () => {
    const csv =
      "Data;Histórico;Valor\nontem;MERCADO;-120,00\n27/08/2026;MERCADO;saldo\n27/08/2026;;-10,00";
    const rows = mapCsvRows(parseCsv(csv, ";"), perfilBr);

    expect(rows[0]!.errors).toContain("DATA_INVALIDA");
    expect(rows[1]!.errors).toContain("VALOR_INVALIDO");
    expect(rows[2]!.errors).toContain("DESCRICAO_VAZIA");
  });

  it("acusa coluna que o mapeamento aponta e não existe", () => {
    const rows = mapCsvRows(parseCsv(CSV_BR, ";"), {
      ...perfilBr,
      columnMap: { ...perfilBr.columnMap, amount: "Montante" },
    });
    expect(rows[0]!.errors).toContain("COLUNA_AUSENTE");
  });

  it("uma linha ruim não contamina as outras", () => {
    const csv = "Data;Histórico;Valor\nontem;X;-1,00\n27/08/2026;MERCADO;-120,00";
    const rows = mapCsvRows(parseCsv(csv, ";"), perfilBr);
    expect(rows[0]!.errors).not.toEqual([]);
    expect(rows[1]!.errors).toEqual([]);
  });

  it("os códigos de erro não carregam conteúdo do extrato", () => {
    // Os erros são gravados no lote de importação. Um código como
    // "VALOR_INVALIDO" é diagnosticável; a linha crua seria o extrato de volta.
    const rows = mapCsvRows(parseCsv("Data;Histórico;Valor\nontem;SEGREDO;abc", ";"), perfilBr);
    const serializado = JSON.stringify(rows[0]!.errors);
    expect(serializado).not.toContain("SEGREDO");
    expect(serializado).not.toContain("abc");
  });
});

describe("mapOfxTransactions", () => {
  const OFX = `OFXHEADER:100
<OFX><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805120000[-3:BRT]<TRNAMT>-120.00<FITID>F1<MEMO>ANTHROPIC</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260810<TRNAMT>2500.00<FITID>F2<MEMO>SALARIO</STMTTRN>
</BANKTRANLIST></OFX>`;

  it("usa o FITID e a data do arquivo, sem depender de perfil", () => {
    const rows = mapOfxTransactions(parseOfx(OFX)!);

    expect(rows[0]).toMatchObject({
      externalId: "F1",
      description: "ANTHROPIC",
      amountCents: 12000,
      direction: "OUT",
      errors: [],
    });
    // A hora com fuso vem no arquivo e é descartada: o que importa é o dia.
    expect(formatUtcDate(rows[0]!.date!)).toBe("2026-08-05");
    expect(rows[1]).toMatchObject({ direction: "IN", externalId: "F2" });
  });

  it("transação sem valor vira linha com erro, não some", () => {
    const doc = parseOfx(
      "OFXHEADER:100\n<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260805<FITID>1<MEMO>X</STMTTRN></BANKTRANLIST></OFX>",
    )!;
    expect(mapOfxTransactions(doc)[0]!.errors).toContain("VALOR_INVALIDO");
  });
});
