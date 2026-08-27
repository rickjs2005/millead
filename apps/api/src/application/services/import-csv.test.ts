import { describe, expect, it } from "vitest";
import { parseCsv, sniffDelimiter } from "./import-csv.js";

describe("sniffDelimiter", () => {
  it("reconhece vírgula, ponto e vírgula e tab", () => {
    expect(sniffDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(sniffDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(sniffDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });

  it("escolhe o separador que dá o mesmo número de colunas em todas as linhas", () => {
    // Extrato brasileiro com ponto e vírgula E vírgula decimal: contar
    // ocorrências elegeria a vírgula e quebraria toda linha.
    const csv = "Data;Descrição;Valor\n27/08/2026;MERCADO;1.234,56\n28/08/2026;IFOOD;45,90";
    expect(sniffDelimiter(csv)).toBe(";");
  });

  it("cai na vírgula quando não dá pra decidir", () => {
    expect(sniffDelimiter("linha unica sem separador")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("lê linhas e colunas simples", () => {
    const doc = parseCsv("Data,Descricao,Valor\n27/08/2026,MERCADO,120.00");
    expect(doc.delimiter).toBe(",");
    expect(doc.rows).toEqual([
      ["Data", "Descricao", "Valor"],
      ["27/08/2026", "MERCADO", "120.00"],
    ]);
  });

  it("respeita campo entre aspas com o separador dentro", () => {
    const doc = parseCsv('Data,Descricao,Valor\n27/08/2026,"MERCADO, LTDA",120.00');
    expect(doc.rows[1]).toEqual(["27/08/2026", "MERCADO, LTDA", "120.00"]);
  });

  it("entende aspas duplicadas dentro do campo", () => {
    const doc = parseCsv('a,b\n1,"diz ""oi"" aqui"');
    expect(doc.rows[1]).toEqual(["1", 'diz "oi" aqui']);
  });

  it("entende quebra de linha dentro de campo entre aspas", () => {
    const doc = parseCsv('a,b\n1,"linha1\nlinha2"');
    expect(doc.rows).toHaveLength(2);
    expect(doc.rows[1]![1]).toBe("linha1\nlinha2");
  });

  it("aceita CRLF e BOM — é o que o Excel gera", () => {
    const doc = parseCsv("﻿a,b\r\n1,2\r\n");
    expect(doc.rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("descarta linha totalmente vazia", () => {
    const doc = parseCsv("a,b\n\n1,2\n\n");
    expect(doc.rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("arquivo vazio devolve nenhuma linha em vez de explodir", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("   ").rows).toEqual([]);
  });
});
