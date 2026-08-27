import type { CsvDocument } from "./import-csv.js";
import type { ColumnMap, ImportProfileSettings } from "./import-mapper.js";
import { parseImportedAmount } from "./import-amount.js";
import { parseImportedDate, type DateOrder } from "./import-date.js";
import { normalizeDescription } from "./transaction-text.js";

/**
 * Adivinhação de mapeamento de CSV — pelo cabeçalho e pelos dados.
 *
 * ## O que "adivinhar" significa aqui
 *
 * Nada é inventado: cada decisão sai de evidência no próprio arquivo. O
 * cabeçalho diz o nome da coluna; as células dizem se aquilo parece data,
 * valor ou texto. Quando as duas fontes não bastam, o campo fica **sem
 * mapeamento** e a tela pergunta — em vez de escolher a coluna errada e
 * importar valores no campo de data.
 *
 * ## A ordem das datas é o risco real
 *
 * `05/08/2026` é 5 de agosto no Brasil e 8 de maio nos EUA. Um erro aqui não
 * dá erro nenhum: as datas entram, todas plausíveis, todas erradas por meses.
 * Por isso a ordem sai de **evidência**, não de padrão: procura-se no arquivo
 * uma linha que só faz sentido de um jeito (dia > 12), e só na ausência
 * completa dela o formato brasileiro é assumido — com confiança marcada como
 * baixa, para a tela avisar.
 */

/** Cabeçalhos conhecidos, na forma normalizada (maiúscula, sem acento). */
const SINONIMOS: Record<keyof ColumnMap, readonly string[]> = {
  date: [
    "DATA",
    "DATE",
    "DATA LANCAMENTO",
    "DATA DO LANCAMENTO",
    "DATA MOVIMENTO",
    "DATA DA COMPRA",
    "DT",
    "POSTED DATE",
    "TRANSACTION DATE",
  ],
  description: [
    "DESCRICAO",
    "DESCRIPTION",
    "HISTORICO",
    "LANCAMENTO",
    "MEMO",
    "DETALHE",
    "DETALHES",
    "ESTABELECIMENTO",
    "TITLE",
    "NARRATIVE",
    "REFERENCIA",
  ],
  amount: ["VALOR", "AMOUNT", "VALOR R$", "MONTANTE", "VALOR DA TRANSACAO", "TRANSACTION AMOUNT"],
  debit: ["DEBITO", "DEBIT", "SAIDA", "SAIDAS", "VALOR DEBITO", "WITHDRAWAL", "PAGAMENTO"],
  credit: ["CREDITO", "CREDIT", "ENTRADA", "ENTRADAS", "VALOR CREDITO", "DEPOSIT"],
  externalId: [
    "ID",
    "IDENTIFICADOR",
    "TRANSACTION ID",
    "TRANSACTION_ID",
    "FITID",
    "ID DA TRANSACAO",
    "DOCUMENTO",
  ],
};

/** Colunas que existem no arquivo mas o Cofre não importa — só informativas. */
const IGNORADAS = ["SALDO", "BALANCE", "CATEGORIA", "CATEGORY", "PARCELA", "TIPO", "TYPE"];

export type Confidence = "alta" | "media" | "baixa";

export interface DetectedSettings {
  settings: ImportProfileSettings;
  confidence: Confidence;
  /** O que não deu para determinar sozinho — a tela mostra e pede confirmação. */
  pendencias: string[];
  /** Colunas reconhecidas mas não importadas, para a tela poder dizer isso. */
  ignoradas: string[];
}

export function detectCsvSettings(doc: CsvDocument): DetectedSettings | null {
  const [header, ...body] = doc.rows;
  if (!header || header.length < 2) return null;

  const temCabecalho = looksLikeHeader(header);
  const amostra = (temCabecalho ? body : doc.rows).slice(0, 40);
  if (amostra.length === 0) return null;

  const nomes = header.map(normalizeDescription);
  const pendencias: string[] = [];

  const porNome = (campo: keyof ColumnMap): number | null =>
    temCabecalho ? matchColumn(nomes, SINONIMOS[campo]) : null;

  // Nome primeiro, forma depois. O cabeçalho é a intenção declarada; a forma
  // dos dados é o que sobra quando ele não existe ou não ajuda.
  const dateIndex = porNome("date") ?? guessByShape(amostra, isDateLike);
  const descriptionIndex = porNome("description") ?? guessByShape(amostra, isTextLike);
  const externalIdIndex = porNome("externalId");

  let amountIndex = porNome("amount");
  const debitIndex = porNome("debit");
  const creditIndex = porNome("credit");
  const separadas = debitIndex !== null && creditIndex !== null;
  if (amountIndex === null && !separadas) {
    amountIndex = guessByShape(amostra, isAmountLike, [dateIndex, descriptionIndex]);
  }

  if (dateIndex === null) pendencias.push("Não identifiquei a coluna de data.");
  if (descriptionIndex === null) pendencias.push("Não identifiquei a coluna de descrição.");
  if (amountIndex === null && !separadas) pendencias.push("Não identifiquei a coluna de valor.");

  if (dateIndex === null || descriptionIndex === null || (amountIndex === null && !separadas)) {
    return {
      settings: fallbackSettings(doc, temCabecalho),
      confidence: "baixa",
      pendencias,
      ignoradas: colunasIgnoradas(nomes, temCabecalho),
    };
  }

  const colunaValores = amountIndex ?? debitIndex ?? creditIndex ?? 0;
  const decimal = detectDecimalSeparator(amostra, colunaValores);
  const data = detectDateOrder(amostra, dateIndex);
  if (data.confidence !== "alta") {
    pendencias.push(
      "A ordem de dia e mês não pôde ser confirmada pelos dados — confira antes de importar.",
    );
  }

  const columnMap: ColumnMap = {
    date: dateIndex,
    description: descriptionIndex,
    ...(separadas ? { debit: debitIndex, credit: creditIndex } : { amount: amountIndex! }),
    ...(externalIdIndex !== null ? { externalId: externalIdIndex } : {}),
  };

  return {
    settings: {
      delimiter: doc.delimiter,
      decimalSeparator: decimal,
      dateOrder: data.order,
      hasHeader: temCabecalho,
      // Sinal invertido é peculiaridade de banco, não coisa que se detecte de
      // 40 linhas: assumir e errar transformaria toda receita em despesa.
      invertSign: false,
      columnMap,
    },
    confidence: pendencias.length === 0 ? "alta" : "media",
    pendencias,
    ignoradas: colunasIgnoradas(nomes, temCabecalho),
  };
}

function fallbackSettings(doc: CsvDocument, hasHeader: boolean): ImportProfileSettings {
  return {
    delimiter: doc.delimiter,
    decimalSeparator: ",",
    dateOrder: "DMY",
    hasHeader,
    invertSign: false,
    columnMap: { date: 0, description: 1, amount: 2 },
  };
}

function colunasIgnoradas(nomes: string[], hasHeader: boolean): string[] {
  if (!hasHeader) return [];
  return nomes.filter((nome) => IGNORADAS.some((alvo) => nome.includes(alvo)));
}

/**
 * A primeira linha é cabeçalho?
 *
 * Se ela tivesse uma data ou um valor, seria dado. Cabeçalho é a linha em que
 * nenhuma célula parece nenhum dos dois.
 */
function looksLikeHeader(row: string[]): boolean {
  return !row.some((cell) => isDateLike(cell) || isAmountLike(cell));
}

function matchColumn(nomes: string[], sinonimos: readonly string[]): number | null {
  // Igualdade exata primeiro: "DATA" não deve casar com "DATA DE VENCIMENTO"
  // quando existe uma coluna chamada exatamente "DATA".
  const exato = nomes.findIndex((nome) => sinonimos.includes(nome));
  if (exato >= 0) return exato;

  const parcial = nomes.findIndex((nome) =>
    sinonimos.some((alvo) => nome.startsWith(alvo) || nome.endsWith(alvo)),
  );
  return parcial >= 0 ? parcial : null;
}

/** A coluna em que a maioria das células tem a forma procurada. */
function guessByShape(
  amostra: string[][],
  parece: (cell: string) => boolean,
  excluir: Array<number | null> = [],
): number | null {
  const colunas = Math.max(...amostra.map((linha) => linha.length));
  let melhor: { index: number; acertos: number } | null = null;

  for (let i = 0; i < colunas; i++) {
    if (excluir.includes(i)) continue;
    const acertos = amostra.filter((linha) => parece(linha[i] ?? "")).length;
    if (acertos > (melhor?.acertos ?? 0)) melhor = { index: i, acertos };
  }

  // Maioria simples: uma coluna com metade das células fora do formato não é
  // aquela coluna, é coincidência.
  return melhor && melhor.acertos > amostra.length / 2 ? melhor.index : null;
}

function isDateLike(cell: string): boolean {
  return /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/.test(cell.trim());
}

function isAmountLike(cell: string): boolean {
  const texto = cell.trim();
  if (texto === "") return false;
  return /^-?R?\$?\s?-?\d{1,3}(([.,]\d{3})*)?([.,]\d{1,2})?-?$/.test(texto) && /\d/.test(texto);
}

function isTextLike(cell: string): boolean {
  const texto = cell.trim();
  return texto.length >= 3 && /[a-zA-Z]/.test(texto) && !isDateLike(texto) && !isAmountLike(texto);
}

/**
 * Vírgula ou ponto como separador decimal.
 *
 * `1.234,56` só existe em pt-BR e `1,234.56` só em en-US: quando os dois
 * separadores aparecem juntos, o **último** é o decimal, e isso é definitivo.
 * Com um só, a pista é a quantidade de casas: dois dígitos depois do separador
 * é decimal; três é milhar.
 */
export function detectDecimalSeparator(amostra: string[][], coluna: number): "," | "." {
  let virgula = 0;
  let ponto = 0;

  for (const linha of amostra) {
    const texto = (linha[coluna] ?? "").trim();
    if (!texto) continue;

    const temVirgula = texto.includes(",");
    const temPonto = texto.includes(".");

    if (temVirgula && temPonto) {
      if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) virgula++;
      else ponto++;
      continue;
    }
    if (temVirgula && /,\d{1,2}$/.test(texto)) virgula++;
    if (temPonto && /\.\d{1,2}$/.test(texto)) ponto++;
  }

  // Empate (inclusive zero a zero, num arquivo só de inteiros) vai pra vírgula:
  // é o formato do país, e sem casa decimal a escolha não muda resultado nenhum.
  return ponto > virgula ? "." : ",";
}

/**
 * Ordem de dia e mês — por evidência, não por padrão.
 *
 * Uma linha com o primeiro número acima de 12 só pode ser dia; acima de 12 no
 * segundo, só pode ser mês. Basta uma para decidir o arquivo inteiro. Sem
 * nenhuma (um extrato só com datas até o dia 12), a resposta é o formato
 * brasileiro com confiança BAIXA — e é a tela que avisa, porque errar aqui não
 * gera erro nenhum, só meses trocados.
 */
export function detectDateOrder(
  amostra: string[][],
  coluna: number,
): { order: DateOrder; confidence: Confidence } {
  let dmy = 0;
  let mdy = 0;
  let iso = 0;

  for (const linha of amostra) {
    const texto = (linha[coluna] ?? "").trim();
    const partes = texto.split(/[/\-.]/);
    if (partes.length !== 3) continue;

    if (partes[0]!.length === 4) {
      iso++;
      continue;
    }
    const primeiro = Number(partes[0]);
    const segundo = Number(partes[1]);
    if (primeiro > 12 && segundo <= 12) dmy++;
    if (segundo > 12 && primeiro <= 12) mdy++;
  }

  if (iso > dmy + mdy) return { order: "YMD", confidence: "alta" };
  if (dmy > mdy) return { order: "DMY", confidence: "alta" };
  if (mdy > dmy) return { order: "MDY", confidence: "alta" };
  return { order: "DMY", confidence: "baixa" };
}

/** Quantas linhas da amostra o mapeamento consegue ler sem erro. */
export function scoreSettings(doc: CsvDocument, settings: ImportProfileSettings): number {
  const [header, ...body] = doc.rows;
  if (!header) return 0;
  const linhas = (settings.hasHeader ? body : doc.rows).slice(0, 20);
  if (linhas.length === 0) return 0;

  const indice = (coluna: string | number | undefined): number | null => {
    if (coluna === undefined) return null;
    if (typeof coluna === "number") return coluna;
    const pos = header.map(normalizeDescription).indexOf(normalizeDescription(coluna));
    return pos >= 0 ? pos : null;
  };

  const dateIndex = indice(settings.columnMap.date);
  const amountIndex = indice(settings.columnMap.amount ?? settings.columnMap.debit);
  if (dateIndex === null) return 0;

  const validas = linhas.filter((linha) => {
    const data = parseImportedDate(linha[dateIndex] ?? "", settings.dateOrder);
    if (!data) return false;
    if (amountIndex === null) return true;
    return parseImportedAmount(linha[amountIndex] ?? "", settings.decimalSeparator) !== null;
  });

  return validas.length / linhas.length;
}
