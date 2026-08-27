import { describe, expect, it } from "vitest";
import { classifyImportRows, summarizeClassification } from "./import-dedup.js";
import { buildFingerprint } from "./transaction-fingerprint.js";
import { utcDate } from "./vault-date.js";

const row = (over: Partial<Parameters<typeof classifyImportRows>[0][number]> = {}) => ({
  line: 1,
  fingerprint: "calc:aaa",
  errors: [] as string[],
  ...over,
});

describe("classifyImportRows", () => {
  it("linha nova é NEW", () => {
    expect(classifyImportRows([row()], new Set())).toEqual(["NEW"]);
  });

  it("linha com erro é INVALID e nem é comparada", () => {
    expect(classifyImportRows([row({ errors: ["DATA_INVALIDA"] })], new Set())).toEqual([
      "INVALID",
    ]);
  });

  it("fingerprint que já existe no Cofre é DUPLICATE_VAULT", () => {
    expect(classifyImportRows([row({ fingerprint: "calc:x" })], new Set(["calc:x"]))).toEqual([
      "DUPLICATE_VAULT",
    ]);
  });

  it("a MESMA linha repetida dentro do arquivo: a primeira entra, a segunda é duplicata", () => {
    // Acontece quando a pessoa exporta um período que se sobrepõe ao anterior
    // e cola os dois arquivos, ou quando o banco repete a linha.
    const result = classifyImportRows(
      [row({ line: 1, fingerprint: "calc:x" }), row({ line: 2, fingerprint: "calc:x" })],
      new Set(),
    );
    expect(result).toEqual(["NEW", "DUPLICATE_FILE"]);
  });

  it("o Cofre vence o arquivo: já importado continua duplicata mesmo repetido", () => {
    const result = classifyImportRows(
      [row({ line: 1, fingerprint: "calc:x" }), row({ line: 2, fingerprint: "calc:x" })],
      new Set(["calc:x"]),
    );
    expect(result).toEqual(["DUPLICATE_VAULT", "DUPLICATE_VAULT"]);
  });

  it("linha sem fingerprint (inválida por definição) não é comparada", () => {
    expect(classifyImportRows([row({ fingerprint: null })], new Set())).toEqual(["INVALID"]);
  });
});

describe("reimportar o mesmo arquivo não duplica nada", () => {
  it("segunda passada classifica tudo como duplicata", () => {
    const linhas = [
      {
        line: 1,
        sourceId: "acc-1",
        transactionDate: utcDate(2026, 8, 5),
        amountBrl: "120.00",
        direction: "OUT" as const,
        normalizedDescription: "ANTHROPIC",
        externalId: null,
      },
      {
        line: 2,
        sourceId: "acc-1",
        transactionDate: utcDate(2026, 8, 6),
        amountBrl: "45.90",
        direction: "OUT" as const,
        normalizedDescription: "IFOOD",
        externalId: null,
      },
    ];
    const fingerprints = linhas.map((l) => buildFingerprint(l));

    const primeira = classifyImportRows(
      linhas.map((l, i) => ({ line: l.line, fingerprint: fingerprints[i]!, errors: [] })),
      new Set(),
    );
    expect(primeira).toEqual(["NEW", "NEW"]);

    // Depois de confirmar, os fingerprints estão no Cofre.
    const segunda = classifyImportRows(
      linhas.map((l, i) => ({ line: l.line, fingerprint: fingerprints[i]!, errors: [] })),
      new Set(fingerprints),
    );
    expect(segunda).toEqual(["DUPLICATE_VAULT", "DUPLICATE_VAULT"]);
  });

  it("FITID repetido é pego mesmo se a descrição e o valor mudarem", () => {
    // Banco que reescreve o texto entre um extrato e outro. Sem a prioridade
    // do FITID, a reimportação criaria uma linha nova.
    const base = {
      sourceId: "acc-1",
      transactionDate: utcDate(2026, 8, 5),
      amountBrl: "120.00",
      direction: "OUT" as const,
      normalizedDescription: "ANTHROPIC",
      externalId: "F1",
    };
    const antes = buildFingerprint(base);
    const depois = buildFingerprint({
      ...base,
      normalizedDescription: "ANTHROPIC CLAUDE PRO",
      amountBrl: "121.00",
    });

    expect(
      classifyImportRows([{ line: 1, fingerprint: depois, errors: [] }], new Set([antes])),
    ).toEqual(["DUPLICATE_VAULT"]);
  });
});

describe("summarizeClassification", () => {
  it("conta cada categoria pro resumo da pré-visualização", () => {
    const resumo = summarizeClassification([
      "NEW",
      "NEW",
      "DUPLICATE_FILE",
      "DUPLICATE_VAULT",
      "INVALID",
    ]);
    expect(resumo).toEqual({ total: 5, novas: 2, duplicadas: 2, invalidas: 1 });
  });

  it("arquivo vazio soma zero em tudo", () => {
    expect(summarizeClassification([])).toEqual({
      total: 0,
      novas: 0,
      duplicadas: 0,
      invalidas: 0,
    });
  });
});
