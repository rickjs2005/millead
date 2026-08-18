import type { BriefingAnswer, BriefingField } from "@/types/api";

/**
 * Ids dos itens de um grupo repetível, na ordem em que aparecem nas respostas.
 * Fonte única da numeração: a aba Respostas e a aba Arquivos precisam chamar
 * o mesmo "Serviço 2" de Serviço 2.
 */
export function idsDosItens(field: BriefingField, answers: BriefingAnswer[]): string[] {
  const children = field.children ?? [];
  return Array.from(
    new Set(
      answers
        .filter((a) => children.some((c) => c.id === a.fieldId) && a.groupItemId !== "")
        .map((a) => a.groupItemId),
    ),
  );
}

/** Rótulo do item, ex.: "Serviço 2" -- `itemLabel` do config, ou "Item". */
export function rotuloDoItem(field: BriefingField, index: number): string {
  const rotulo =
    field.config && typeof field.config === "object" && "itemLabel" in field.config
      ? String((field.config as { itemLabel?: string }).itemLabel ?? "Item")
      : "Item";
  return `${rotulo} ${index + 1}`;
}
