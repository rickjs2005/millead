import type { CsvDocument } from "./import-csv.js";
import { parseImportedAmount } from "./import-amount.js";
import { parseImportedDate, type DateOrder } from "./import-date.js";
import type { OfxDocument } from "./import-ofx.js";
import { normalizeDescription } from "./transaction-text.js";

/**
 * Transforma linha de arquivo em linha do Cofre.
 *
 * Duas entradas (CSV mapeado por perfil, OFX auto-descritivo), **uma saída
 * só**: a partir daqui, deduplicação, pré-visualização e gravação não sabem
 * de que formato a linha veio.
 *
 * Erro de linha é um CÓDIGO (`DATA_INVALIDA`), nunca o conteúdo. Estes erros
 * são gravados em `personal_import_batches.errors`, e um log com a linha crua
 * seria o extrato de volta por outra porta.
 */

export type ImportRowError =
  "COLUNA_AUSENTE" | "DATA_INVALIDA" | "VALOR_INVALIDO" | "DESCRICAO_VAZIA";

export interface MappedRow {
  /** Linha no arquivo, 1-based, contando o cabeçalho. */
  line: number;
  date: Date | null;
  description: string;
  normalizedDescription: string;
  /** Sempre positivo; o sentido fica em `direction`. */
  amountCents: number | null;
  direction: "IN" | "OUT" | null;
  externalId: string | null;
  errors: ImportRowError[];
}

/** De qual coluna sai cada campo: nome do cabeçalho ou índice (0-based). */
export interface ColumnMap {
  date: string | number;
  description: string | number;
  /** Coluna única com sinal. Alternativa a `debit`/`credit`. */
  amount?: string | number;
  /** Colunas separadas, sem sinal — formato comum em conta corrente. */
  debit?: string | number;
  credit?: string | number;
  externalId?: string | number;
}

export interface ImportProfileSettings {
  delimiter: string;
  decimalSeparator: "," | ".";
  dateOrder: DateOrder;
  hasHeader: boolean;
  /** Alguns bancos mandam despesa como positivo. */
  invertSign: boolean;
  columnMap: ColumnMap;
}

export function mapCsvRows(doc: CsvDocument, profile: ImportProfileSettings): MappedRow[] {
  const [header, ...body] = doc.rows;
  if (!header) return [];

  const dataRows = profile.hasHeader ? body : doc.rows;
  const firstLine = profile.hasHeader ? 2 : 1;
  const headerIndex = profile.hasHeader ? buildHeaderIndex(header) : new Map<string, number>();

  return dataRows.map((cells, offset) => {
    const errors: ImportRowError[] = [];
    const pick = (column: string | number | undefined): string | null => {
      if (column === undefined) return null;
      const index = typeof column === "number" ? column : headerIndex.get(normalizeHeader(column));
      if (index === undefined) {
        // Mapeamento aponta pra uma coluna que não existe: é erro de
        // configuração, e vale a mesma linha inteira, não um campo vazio.
        if (!errors.includes("COLUNA_AUSENTE")) errors.push("COLUNA_AUSENTE");
        return null;
      }
      return cells[index] ?? null;
    };

    const rawDate = pick(profile.columnMap.date);
    const rawDescription = pick(profile.columnMap.description);
    const { amountCents, direction } = readAmount(pick, profile, errors);

    const date = rawDate ? parseImportedDate(rawDate, profile.dateOrder) : null;
    if (!date && !errors.includes("COLUNA_AUSENTE")) errors.push("DATA_INVALIDA");

    const description = (rawDescription ?? "").trim();
    if (!description && !errors.includes("COLUNA_AUSENTE")) errors.push("DESCRICAO_VAZIA");

    return {
      line: firstLine + offset,
      date,
      description,
      normalizedDescription: normalizeDescription(description),
      amountCents,
      direction,
      externalId: pick(profile.columnMap.externalId),
      errors,
    };
  });
}

export function mapOfxTransactions(doc: OfxDocument): MappedRow[] {
  return doc.transactions.map((transaction, offset) => {
    const errors: ImportRowError[] = [];

    // O OFX é auto-descritivo: sempre ponto decimal e sempre AAAAMMDD, então
    // não há perfil pra configurar aqui.
    const date = transaction.datePosted ? parseImportedDate(transaction.datePosted, "YMD") : null;
    if (!date) errors.push("DATA_INVALIDA");

    const parsed = transaction.amount ? parseImportedAmount(transaction.amount, ".") : null;
    if (!parsed) errors.push("VALOR_INVALIDO");

    const description = transaction.description.trim();
    if (!description) errors.push("DESCRICAO_VAZIA");

    return {
      line: offset + 1,
      date,
      description,
      normalizedDescription: normalizeDescription(description),
      amountCents: parsed?.cents ?? null,
      direction: parsed ? (parsed.negative ? "OUT" : "IN") : null,
      externalId: transaction.fitid,
      errors,
    };
  });
}

function readAmount(
  pick: (column: string | number | undefined) => string | null,
  profile: ImportProfileSettings,
  errors: ImportRowError[],
): { amountCents: number | null; direction: "IN" | "OUT" | null } {
  const { columnMap, decimalSeparator, invertSign } = profile;

  // Débito e crédito em colunas separadas: o sentido vem da coluna preenchida,
  // e não de sinal nenhum.
  if (columnMap.debit !== undefined || columnMap.credit !== undefined) {
    const debit = columnMap.debit !== undefined ? pick(columnMap.debit) : null;
    const credit = columnMap.credit !== undefined ? pick(columnMap.credit) : null;

    const parsedDebit = debit ? parseImportedAmount(debit, decimalSeparator) : null;
    const parsedCredit = credit ? parseImportedAmount(credit, decimalSeparator) : null;

    if (parsedDebit && !parsedCredit) {
      return { amountCents: parsedDebit.cents, direction: invertSign ? "IN" : "OUT" };
    }
    if (parsedCredit && !parsedDebit) {
      return { amountCents: parsedCredit.cents, direction: invertSign ? "OUT" : "IN" };
    }
    // Nenhuma das duas, ou as duas ao mesmo tempo: a linha não diz o que
    // aconteceu, e inventar um lado seria pior que recusar.
    if (!errors.includes("VALOR_INVALIDO")) errors.push("VALOR_INVALIDO");
    return { amountCents: null, direction: null };
  }

  const raw = pick(columnMap.amount);
  const parsed = raw ? parseImportedAmount(raw, decimalSeparator) : null;
  if (!parsed) {
    if (!errors.includes("COLUNA_AUSENTE") && !errors.includes("VALOR_INVALIDO")) {
      errors.push("VALOR_INVALIDO");
    }
    return { amountCents: null, direction: null };
  }

  const saida = invertSign ? !parsed.negative : parsed.negative;
  return { amountCents: parsed.cents, direction: saida ? "OUT" : "IN" };
}

function buildHeaderIndex(header: string[]): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, position) => index.set(normalizeHeader(name), position));
  return index;
}

/** Cabeçalho casa sem depender de acento nem de caixa: "Histórico" = "HISTORICO". */
function normalizeHeader(name: string): string {
  return normalizeDescription(name);
}
