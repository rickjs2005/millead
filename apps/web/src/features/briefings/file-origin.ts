import type { BriefingAnswer, BriefingFile, BriefingSection } from "@/types/api";
import { idsDosItens, rotuloDoItem } from "./group-items";

/** Arquivo que nenhuma resposta referencia -- some da tela seria pior. */
export const SEM_ORIGEM = "Sem pergunta associada";

export interface OrigemArquivo {
  /** Caminho legível, ex.: "Serviços › Serviço 2 › Imagem". */
  caminho: string;
  /** Posição na ordem do formulário -- agrupa e ordena a lista de arquivos. */
  ordem: number;
}

export interface GrupoDeArquivos {
  caminho: string;
  arquivos: BriefingFile[];
}

function idsDeArquivo(answer: BriefingAnswer | undefined): string[] {
  if (!answer || !Array.isArray(answer.valueJson)) return [];
  return (answer.valueJson as unknown[]).filter((v): v is string => typeof v === "string");
}

/**
 * De qual pergunta veio cada arquivo. O vínculo já existe no banco (a resposta
 * de um campo FILE guarda os ids dos arquivos) -- isto só o torna legível.
 */
export function origensDosArquivos(
  sections: BriefingSection[],
  answers: BriefingAnswer[],
): Map<string, OrigemArquivo> {
  const origens = new Map<string, OrigemArquivo>();
  let ordem = 0;

  const resposta = (fieldId: string, groupItemId = "") =>
    answers.find((a) => a.fieldId === fieldId && a.groupItemId === groupItemId);

  const registrar = (answer: BriefingAnswer | undefined, caminho: string) => {
    for (const id of idsDeArquivo(answer)) {
      if (!origens.has(id)) origens.set(id, { caminho, ordem: ordem++ });
    }
  };

  for (const section of sections) {
    for (const field of section.fields) {
      if (field.type === "GROUP") {
        idsDosItens(field, answers).forEach((groupItemId, index) => {
          for (const child of field.children ?? []) {
            if (child.type !== "FILE") continue;
            registrar(
              resposta(child.id, groupItemId),
              `${section.title} › ${rotuloDoItem(field, index)} › ${child.label}`,
            );
          }
        });
      } else if (field.type === "FILE") {
        registrar(resposta(field.id), `${section.title} › ${field.label}`);
      }
    }
  }

  return origens;
}

/** Agrupa os arquivos por pergunta, na ordem do formulário; órfãos no fim. */
export function agruparArquivosPorOrigem(
  files: BriefingFile[],
  origens: Map<string, OrigemArquivo>,
): GrupoDeArquivos[] {
  const ordenados = [...files].sort(
    (a, b) =>
      (origens.get(a.id)?.ordem ?? Number.MAX_SAFE_INTEGER) -
      (origens.get(b.id)?.ordem ?? Number.MAX_SAFE_INTEGER),
  );

  const grupos: GrupoDeArquivos[] = [];
  for (const file of ordenados) {
    const caminho = origens.get(file.id)?.caminho ?? SEM_ORIGEM;
    const ultimo = grupos.at(-1);
    if (ultimo?.caminho === caminho) ultimo.arquivos.push(file);
    else grupos.push({ caminho, arquivos: [file] });
  }
  return grupos;
}
