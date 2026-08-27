import { describe, expect, it } from "vitest";
import { parseCsv } from "./import-csv.js";
import {
  detectCsvSettings,
  detectDateOrder,
  detectDecimalSeparator,
  scoreSettings,
} from "./import-autodetect.js";

/** Extratos inventados, nos formatos que os bancos brasileiros exportam. */
const CSV_BR = `Data;Histórico;Valor
05/08/2026;MERCADO BOM PRECO;-1.234,56
15/08/2026;SALARIO;5.000,00
28/08/2026;IFOOD*RESTAURANTE;-45,90`;

const CSV_INTERNACIONAL = `Date,Description,Amount
2026-08-05,GROCERY STORE,-1234.56
2026-08-15,PAYROLL,5000.00
2026-08-28,COFFEE SHOP,-4.50`;

const CSV_DEBITO_CREDITO = `Data;Lançamento;Débito;Crédito;Saldo
05/08/2026;MERCADO;120,50;;3.000,00
15/08/2026;DEPOSITO;;500,00;3.500,00`;

const CSV_SEM_CABECALHO = `05/08/2026;MERCADO BOM PRECO;-120,50
15/08/2026;SALARIO MENSAL;5000,00`;

describe("CSV brasileiro", () => {
  const d = detectCsvSettings(parseCsv(CSV_BR))!;

  it("acha as colunas pelo nome do cabeçalho", () => {
    expect(d.settings.columnMap).toMatchObject({ date: 0, description: 1, amount: 2 });
  });

  it("reconhece ponto e vírgula, vírgula decimal e ordem dia/mês", () => {
    expect(d.settings.delimiter).toBe(";");
    expect(d.settings.decimalSeparator).toBe(",");
    expect(d.settings.dateOrder).toBe("DMY");
    expect(d.settings.hasHeader).toBe(true);
  });

  it("confiança alta, sem pendência", () => {
    expect(d.confidence).toBe("alta");
    expect(d.pendencias).toEqual([]);
  });
});

describe("CSV internacional", () => {
  const d = detectCsvSettings(parseCsv(CSV_INTERNACIONAL))!;

  it("reconhece vírgula, ponto decimal e data ISO", () => {
    expect(d.settings.delimiter).toBe(",");
    expect(d.settings.decimalSeparator).toBe(".");
    expect(d.settings.dateOrder).toBe("YMD");
  });

  it("acha as colunas em inglês", () => {
    expect(d.settings.columnMap).toMatchObject({ date: 0, description: 1, amount: 2 });
    expect(d.confidence).toBe("alta");
  });
});

describe("débito e crédito em colunas separadas", () => {
  const d = detectCsvSettings(parseCsv(CSV_DEBITO_CREDITO))!;

  it("mapeia as duas e não usa coluna única de valor", () => {
    expect(d.settings.columnMap.debit).toBe(2);
    expect(d.settings.columnMap.credit).toBe(3);
    expect(d.settings.columnMap.amount).toBeUndefined();
  });

  it("avisa que a coluna de saldo existe mas não é importada", () => {
    expect(d.ignoradas).toContain("SALDO");
  });
});

describe("CSV sem cabeçalho", () => {
  const d = detectCsvSettings(parseCsv(CSV_SEM_CABECALHO))!;

  it("percebe que a primeira linha já é dado", () => {
    // Se ela tivesse data ou valor, seria dado -- e tem os dois.
    expect(d.settings.hasHeader).toBe(false);
  });

  it("acha as colunas pela forma das células", () => {
    expect(d.settings.columnMap.date).toBe(0);
    expect(d.settings.columnMap.description).toBe(1);
    expect(d.settings.columnMap.amount).toBe(2);
  });
});

describe("quando não dá para saber", () => {
  it("arquivo sem coluna reconhecível não vira palpite silencioso", () => {
    const d = detectCsvSettings(parseCsv("A;B;C\nx;y;z\nw;k;j"))!;
    expect(d.confidence).toBe("baixa");
    expect(d.pendencias.length).toBeGreaterThan(0);
  });

  it("arquivo vazio devolve null", () => {
    expect(detectCsvSettings(parseCsv(""))).toBeNull();
    expect(detectCsvSettings(parseCsv("apenas-uma-coluna"))).toBeNull();
  });
});

describe("ordem de dia e mês — o erro que não dá erro", () => {
  const linhas = (datas: string[]) => datas.map((d) => [d, "X", "1,00"]);

  it("um dia acima de 12 decide o arquivo inteiro", () => {
    expect(detectDateOrder(linhas(["05/08/2026", "28/08/2026"]), 0)).toEqual({
      order: "DMY",
      confidence: "alta",
    });
  });

  it("mês acima de 12 na segunda posição indica formato americano", () => {
    expect(detectDateOrder(linhas(["08/28/2026", "12/31/2026"]), 0)).toEqual({
      order: "MDY",
      confidence: "alta",
    });
  });

  it("ISO é reconhecido sem ambiguidade", () => {
    expect(detectDateOrder(linhas(["2026-08-05", "2026-08-28"]), 0).order).toBe("YMD");
  });

  it("sem evidência, assume Brasil MAS marca confiança baixa", () => {
    // Todas as datas até o dia 12 servem nos dois formatos. Assumir em
    // silêncio deslocaria meses inteiros sem nenhum erro aparecer.
    const r = detectDateOrder(linhas(["05/08/2026", "07/09/2026"]), 0);
    expect(r.order).toBe("DMY");
    expect(r.confidence).toBe("baixa");
  });

  it("e a pendência chega à tela", () => {
    const csv = "Data;Descricao;Valor\n05/08/2026;MERCADO;10,00\n07/09/2026;PADARIA;20,00";
    const d = detectCsvSettings(parseCsv(csv))!;
    expect(d.confidence).toBe("media");
    expect(d.pendencias.join(" ")).toMatch(/ordem de dia e mês/i);
  });
});

describe("separador decimal", () => {
  const col = (valores: string[]) => valores.map((v) => ["01/01/2026", "X", v]);

  it("com os dois separadores, o último é o decimal", () => {
    expect(detectDecimalSeparator(col(["1.234,56", "2.000,00"]), 2)).toBe(",");
    expect(detectDecimalSeparator(col(["1,234.56", "2,000.00"]), 2)).toBe(".");
  });

  it("com um só, decide pela quantidade de casas", () => {
    expect(detectDecimalSeparator(col(["1234,56", "45,90"]), 2)).toBe(",");
    expect(detectDecimalSeparator(col(["1234.56", "45.90"]), 2)).toBe(".");
  });

  it("três casas é milhar, não decimal", () => {
    expect(detectDecimalSeparator(col(["1.234", "5.000"]), 2)).toBe(",");
  });

  it("sem casa decimal nenhuma, empate vai pro formato do país", () => {
    // E não muda resultado: inteiro é inteiro nos dois.
    expect(detectDecimalSeparator(col(["1234", "5000"]), 2)).toBe(",");
  });
});

describe("pontuação do mapeamento", () => {
  it("mapeamento certo lê o arquivo inteiro", () => {
    const doc = parseCsv(CSV_BR);
    expect(scoreSettings(doc, detectCsvSettings(doc)!.settings)).toBe(1);
  });

  it("mapeamento errado pontua baixo — é o que descarta um perfil salvo", () => {
    const doc = parseCsv(CSV_BR);
    const errado = {
      ...detectCsvSettings(doc)!.settings,
      columnMap: { date: 2, description: 1, amount: 0 },
    };
    expect(scoreSettings(doc, errado)).toBeLessThan(0.5);
  });
});
