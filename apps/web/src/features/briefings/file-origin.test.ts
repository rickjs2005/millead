import { describe, expect, it } from "vitest";
import type { BriefingAnswer, BriefingField, BriefingFile, BriefingSection } from "@/types/api";
import { agruparArquivosPorOrigem, origensDosArquivos } from "./file-origin";

function campo(over: Partial<BriefingField> & { id: string; label: string }): BriefingField {
  return {
    sectionId: "sec-1",
    parentFieldId: null,
    key: over.id,
    type: "FILE",
    order: 0,
    required: false,
    helpText: null,
    config: null,
    ...over,
  };
}

function resposta(fieldId: string, fileIds: string[], groupItemId = ""): BriefingAnswer {
  return {
    id: `ans-${fieldId}-${groupItemId}`,
    briefingId: "b-1",
    fieldId,
    groupItemId,
    groupItemOrder: null,
    valueText: null,
    valueJson: fileIds,
    updatedAt: "2026-08-17T20:31:00Z",
  };
}

function arquivo(id: string, nome: string): BriefingFile {
  return {
    id,
    briefingId: "b-1",
    blobUrl: `https://blob/${id}`,
    pathname: nome,
    originalName: nome,
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    createdAt: "2026-08-17T20:00:00Z",
  };
}

/** Espelha o briefing real: uma seção com campo solto e um grupo repetível. */
const IDENTIDADE: BriefingSection = {
  id: "sec-1",
  templateId: "t-1",
  key: "identidade",
  title: "Identidade",
  description: null,
  order: 0,
  fields: [campo({ id: "f-logo", label: "Logo" })],
};

const SERVICOS: BriefingSection = {
  id: "sec-2",
  templateId: "t-1",
  key: "servicos",
  title: "Serviços",
  description: null,
  order: 1,
  fields: [
    campo({
      id: "f-grupo",
      label: "Serviços",
      type: "GROUP",
      config: { itemLabel: "Serviço" },
      children: [
        campo({ id: "f-nome", label: "Nome", type: "TEXT" }),
        campo({ id: "f-imagem", label: "Imagem" }),
      ],
    }),
  ],
};

describe("origensDosArquivos", () => {
  it("campo solto vira 'Seção › Campo'", () => {
    const origens = origensDosArquivos([IDENTIDADE], [resposta("f-logo", ["file-logo"])]);
    expect(origens.get("file-logo")?.caminho).toBe("Identidade › Logo");
  });

  it("dentro de grupo repetível, numera o item igual à aba Respostas", () => {
    const origens = origensDosArquivos(
      [SERVICOS],
      [
        resposta("f-nome", [], "item-a"),
        resposta("f-imagem", ["file-a"], "item-a"),
        resposta("f-nome", [], "item-b"),
        resposta("f-imagem", ["file-b"], "item-b"),
      ],
    );
    expect(origens.get("file-a")?.caminho).toBe("Serviços › Serviço 1 › Imagem");
    expect(origens.get("file-b")?.caminho).toBe("Serviços › Serviço 2 › Imagem");
  });

  it("uma pergunta com vários arquivos aponta todos pra mesma origem", () => {
    const origens = origensDosArquivos([IDENTIDADE], [resposta("f-logo", ["f1", "f2"])]);
    expect(origens.get("f1")?.caminho).toBe("Identidade › Logo");
    expect(origens.get("f2")?.caminho).toBe("Identidade › Logo");
  });

  it("arquivo que nenhuma resposta referencia não tem origem", () => {
    const origens = origensDosArquivos([IDENTIDADE], [resposta("f-logo", ["file-logo"])]);
    expect(origens.has("file-orfao")).toBe(false);
  });
});

describe("agruparArquivosPorOrigem", () => {
  const files = [
    arquivo("file-b", "servico-2.jpeg"),
    arquivo("file-orfao", "sobrou.jpeg"),
    arquivo("file-a", "servico-1.jpeg"),
  ];
  const origens = origensDosArquivos(
    [SERVICOS],
    [resposta("f-imagem", ["file-a"], "item-a"), resposta("f-imagem", ["file-b"], "item-b")],
  );

  it("agrupa na ordem do formulário, não na ordem de upload", () => {
    const grupos = agruparArquivosPorOrigem(files, origens);
    expect(grupos.map((g) => g.caminho)).toEqual([
      "Serviços › Serviço 1 › Imagem",
      "Serviços › Serviço 2 › Imagem",
      "Sem pergunta associada",
    ]);
  });

  it("o órfão vai pro fim, visível -- some da tela seria pior que não explicado", () => {
    const grupos = agruparArquivosPorOrigem(files, origens);
    expect(grupos.at(-1)?.arquivos.map((a) => a.originalName)).toEqual(["sobrou.jpeg"]);
  });

  it("sem arquivo nenhum, não inventa grupo", () => {
    expect(agruparArquivosPorOrigem([], origens)).toEqual([]);
  });
});
