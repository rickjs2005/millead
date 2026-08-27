/**
 * Leitor de CSV, escrito aqui em vez de trazer uma dependência.
 *
 * São ~60 linhas para o que este módulo precisa (aspas, aspas duplicadas,
 * quebra de linha dentro do campo, CRLF, BOM), e a alternativa seria mais um
 * pacote na cadeia de suprimento de um módulo que lê **extrato bancário**.
 * Para um parser desse tamanho, a conta não fecha a favor da dependência.
 */

export interface CsvDocument {
  delimiter: string;
  /** Linhas totalmente vazias já vêm descartadas. */
  rows: string[][];
}

const CANDIDATE_DELIMITERS = [",", ";", "\t", "|"] as const;

/**
 * Escolhe o separador pela CONSISTÊNCIA de colunas, não pela contagem.
 *
 * Contar ocorrências elegeria a vírgula num extrato brasileiro
 * (`27/08/2026;MERCADO;1.234,56`) porque a vírgula decimal aparece em toda
 * linha — e aí cada linha quebraria num lugar diferente. Um separador de
 * verdade produz o mesmo número de colunas em todas as linhas.
 */
export function sniffDelimiter(text: string): string {
  const sample = stripBom(text)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .slice(0, 20);
  if (sample.length === 0) return ",";

  let best = { delimiter: ",", columns: 1, consistent: false };
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = sample.map((line) => splitLine(line, delimiter).length);
    const columns = counts[0]!;
    if (columns < 2) continue;
    const consistent = counts.every((count) => count === columns);
    // Mais colunas, com consistência, é o sinal mais forte.
    if (consistent && columns > best.columns) best = { delimiter, columns, consistent };
  }

  return best.consistent ? best.delimiter : ",";
}

export function parseCsv(text: string, delimiter?: string): CsvDocument {
  const content = stripBom(text);
  const sep = delimiter ?? sniffDelimiter(content);

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!;

    if (inQuotes) {
      if (char === '"') {
        // Aspas duplicadas dentro do campo representam uma aspa literal.
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // \r\n conta como uma quebra só.
      if (char === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      pushRow(rows, row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  pushRow(rows, row);

  return { delimiter: sep, rows };
}

function pushRow(rows: string[][], row: string[]): void {
  // Linha vazia é ruído de fim de arquivo ou de separador duplo -- descartar
  // aqui evita que toda etapa seguinte tenha que se defender dela.
  if (row.some((cell) => cell.trim().length > 0)) rows.push(row.map((cell) => cell.trim()));
}

/** Divisão simples, só para a heurística de separador (não trata aspas). */
function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
