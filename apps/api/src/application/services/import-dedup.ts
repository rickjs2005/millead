/**
 * Classificação de deduplicação de um arquivo.
 *
 * Duas duplicidades diferentes, e a distinção importa na tela: a linha já
 * existe **no Cofre** (você já importou este período antes) ou se repete
 * **dentro do próprio arquivo** (o banco repetiu, ou você colou dois períodos
 * que se sobrepõem). A primeira você provavelmente esperava; a segunda quase
 * sempre é surpresa.
 *
 * Ordem de precedência: inválida > já no Cofre > repetida no arquivo > nova.
 * "Já no Cofre" vence "repetida no arquivo" porque, se a linha já existe, as
 * duas ocorrências são duplicata — marcar a primeira como nova reimportaria.
 */

export type ImportRowStatus = "NEW" | "DUPLICATE_FILE" | "DUPLICATE_VAULT" | "INVALID";

export interface ClassifiableRow {
  line: number;
  /** Null quando a linha não é gravável (sem data, sem valor…). */
  fingerprint: string | null;
  errors: readonly string[];
}

export function classifyImportRows(
  rows: readonly ClassifiableRow[],
  existingInVault: ReadonlySet<string>,
): ImportRowStatus[] {
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    if (row.errors.length > 0 || !row.fingerprint) return "INVALID";
    if (existingInVault.has(row.fingerprint)) return "DUPLICATE_VAULT";

    if (seenInFile.has(row.fingerprint)) return "DUPLICATE_FILE";
    seenInFile.add(row.fingerprint);
    return "NEW";
  });
}

export interface ClassificationSummary {
  total: number;
  novas: number;
  duplicadas: number;
  invalidas: number;
}

/** Contagem para o resumo da pré-visualização — as duas duplicidades somam. */
export function summarizeClassification(
  statuses: readonly ImportRowStatus[],
): ClassificationSummary {
  return {
    total: statuses.length,
    novas: statuses.filter((status) => status === "NEW").length,
    duplicadas: statuses.filter(
      (status) => status === "DUPLICATE_FILE" || status === "DUPLICATE_VAULT",
    ).length,
    invalidas: statuses.filter((status) => status === "INVALID").length,
  };
}
