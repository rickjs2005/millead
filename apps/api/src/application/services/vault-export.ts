import type { BackupRow, VaultDump } from "../../domain/repositories/personal-backup-repository.js";

/**
 * Formato do backup e a planilha de movimentações.
 *
 * Duas saídas, com propósitos diferentes e que não se substituem:
 *
 * - **JSON** é o backup. Completo, com todas as ligações, e é o único que a
 *   restauração aceita.
 * - **CSV** é pra olhar numa planilha. Só movimentações, achatadas. Não dá pra
 *   restaurar a partir dele, e o arquivo diz isso na primeira coluna.
 */

/**
 * Versão do formato.
 *
 * Existe pra que uma restauração encontre "versão 2" e **recuse**, em vez de
 * adivinhar. Um backup lido pela metade por um leitor antigo é pior que um
 * backup recusado: o segundo você resolve, o primeiro você descobre meses
 * depois com metade da história faltando.
 */
export const EXPORT_VERSION = 1;

export const EXPORT_FORMAT = "millead-cofre";

export interface VaultBackup {
  formato: typeof EXPORT_FORMAT;
  versao: number;
  geradoEm: string;
  /** Contagens no topo, pra conferir de bater o olho se o arquivo veio inteiro
   *  antes de confiar nele. */
  resumo: Record<string, number>;
  conteudo: VaultDump;
}

export function buildBackup(dump: VaultDump, geradoEm: Date): VaultBackup {
  return {
    formato: EXPORT_FORMAT,
    versao: EXPORT_VERSION,
    geradoEm: geradoEm.toISOString(),
    resumo: {
      categorias: dump.categories.length,
      contas: dump.accounts.length,
      cartoes: dump.cards.length,
      fornecedores: dump.merchants.length,
      faturas: dump.statements.length,
      importacoes: dump.importBatches.length,
      assinaturas: dump.subscriptions.length,
      movimentacoes: dump.transactions.length,
      rateios: dump.transactions.reduce((total, t) => total + t.splits.length, 0),
      regras: dump.rules.length,
      alertas: dump.alerts.length,
      pessoas: dump.contacts.length,
      dividas: dump.debts.length,
      baixas: dump.debts.reduce((total, d) => total + d.payments.length, 0),
      enviosAoFinanceiro: dump.businessSends.length,
    },
    conteudo: dump,
  };
}

/** Motivo pelo qual um arquivo não pode ser restaurado, ou `null` se pode. */
export function rejectBackup(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return "O arquivo não é um backup do Cofre.";
  }
  const backup = value as Partial<VaultBackup>;
  if (backup.formato !== EXPORT_FORMAT) {
    return "O arquivo não é um backup do Cofre.";
  }
  if (backup.versao !== EXPORT_VERSION) {
    return (
      `Este backup é da versão ${String(backup.versao)}, e esta instalação lê a versão ` +
      `${EXPORT_VERSION}. Restaurar assim deixaria partes de fora sem avisar.`
    );
  }
  if (typeof backup.conteudo !== "object" || backup.conteudo === null) {
    return "O backup está sem conteúdo.";
  }
  return null;
}

// ----- CSV -----

/**
 * Separador `;` e decimal com vírgula.
 *
 * Não é o CSV do RFC — é o CSV que o Excel em português abre sem pedir nada.
 * A escolha é deliberada: este arquivo existe pra ser olhado numa planilha, e
 * um arquivo tecnicamente correto que abre tudo numa coluna só não serve pra
 * isso. Quem quer o formato exato usa o JSON.
 */
const SEP = ";";

/**
 * Excel trata `=`, `+`, `-`, `@` no começo de um campo como **fórmula**.
 *
 * A descrição vem do extrato do banco, que por sua vez vem do nome que o
 * estabelecimento cadastrou — texto que não é seu e que você não controla.
 * Uma descrição como `=HYPERLINK("http://...")` viraria um link ativo na
 * planilha da pessoa que abriu o arquivo. Prefixar com apóstrofo mata a
 * fórmula e o Excel não mostra o apóstrofo.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const texto = neutralizeFormula(String(value));
  // Aspas duplas escapam dobrando; qualquer campo com separador, aspas ou
  // quebra de linha vai entre aspas.
  if (texto.includes(SEP) || texto.includes('"') || /[\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** `1234.56` -> `1234,56`. O Excel em pt-BR só soma a coluna assim. */
function csvMoney(value: string): string {
  return value.replace(".", ",");
}

function csvDate(value: Date | null): string {
  if (!value) return "";
  // UTC fixo: as colunas de data do Cofre são `@db.Date` a meia-noite UTC, e
  // formatar no fuso local mostraria o dia anterior no Brasil.
  const iso = value.toISOString().slice(0, 10);
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

const CSV_HEADER = [
  "Data",
  "Data de pagamento",
  "Descrição",
  "Direção",
  "Valor",
  "Valor em reais",
  "Moeda",
  "Categoria",
  "Fornecedor",
  "Conta",
  "Cartão",
  "Situação",
  "Transferência",
  "Parte da empresa",
  "Reembolsável",
  "Consumo pessoal",
  "Observação",
];

/**
 * Os campos que a planilha lê — e só eles.
 *
 * O dump é `Record<string, unknown>` de propósito (ver o comentário do
 * repositório). Declarar aqui a fatia usada devolve a tipagem exatamente onde
 * ela paga: se um destes campos mudar de nome no schema, a planilha quebra no
 * compilador, em vez de sair com uma coluna vazia que ninguém nota.
 */
interface CsvTransaction {
  transactionDate: Date;
  settlementDate: Date | null;
  originalDescription: string;
  direction: string;
  amount: string;
  amountBrl: string;
  currency: string;
  categoryId: string | null;
  merchantId: string | null;
  accountId: string | null;
  cardId: string | null;
  status: string;
  isTransfer: boolean;
  note: string | null;
}

interface CsvSplit {
  kind: string;
  amount: string;
}

function asCsvTransaction(row: BackupRow): CsvTransaction {
  return row as unknown as CsvTransaction;
}

export interface CsvNames {
  categories: Map<string, string>;
  merchants: Map<string, string>;
  accounts: Map<string, string>;
  cards: Map<string, string>;
}

/**
 * Movimentações em planilha, com os nomes resolvidos.
 *
 * Exportar ids seria inútil aqui: ninguém abre uma planilha pra ler
 * `cmt3k9...`. A perda é que o CSV não volta pra dentro do sistema — e é por
 * isso que ele não é o backup.
 */
export function toCsv(dump: VaultDump, nomes: CsvNames): string {
  const linhas = [CSV_HEADER.join(SEP)];

  for (const linha of dump.transactions) {
    const t = asCsvTransaction(linha);
    const splits = linha.splits as unknown as CsvSplit[];
    const empresa = somaPorTipo(splits, "BUSINESS");
    const reembolso = somaPorTipo(splits, "REIMBURSABLE");
    const pessoal = (Number(t.amountBrl) - empresa - reembolso).toFixed(2);

    linhas.push(
      [
        csvField(csvDate(t.transactionDate)),
        csvField(csvDate(t.settlementDate)),
        csvField(t.originalDescription),
        csvField(t.direction === "IN" ? "Entrada" : "Saída"),
        csvField(csvMoney(t.amount)),
        csvField(csvMoney(t.amountBrl)),
        csvField(t.currency),
        csvField(t.categoryId ? (nomes.categories.get(t.categoryId) ?? "") : ""),
        csvField(t.merchantId ? (nomes.merchants.get(t.merchantId) ?? "") : ""),
        csvField(t.accountId ? (nomes.accounts.get(t.accountId) ?? "") : ""),
        csvField(t.cardId ? (nomes.cards.get(t.cardId) ?? "") : ""),
        csvField(t.status),
        csvField(t.isTransfer ? "Sim" : "Não"),
        csvField(csvMoney(empresa.toFixed(2))),
        csvField(csvMoney(reembolso.toFixed(2))),
        csvField(csvMoney(pessoal)),
        csvField(t.note),
      ].join(SEP),
    );
  }

  // BOM: sem ele o Excel lê o arquivo como ANSI e "Alimentação" vira
  // "AlimentaÃ§Ã£o". Três bytes que decidem se o arquivo serve ou não.
  return `\uFEFF${linhas.join("\r\n")}\r\n`;
}

function somaPorTipo(splits: readonly CsvSplit[], kind: string): number {
  return splits.filter((s) => s.kind === kind).reduce((total, s) => total + Number(s.amount), 0);
}

function nameOf(row: BackupRow): string {
  return typeof row.name === "string" ? row.name : "";
}

export function buildCsvNames(dump: VaultDump): CsvNames {
  const categories = new Map<string, string>();
  for (const c of dump.categories) {
    const pai =
      typeof c.parentId === "string" ? dump.categories.find((p) => p.id === c.parentId) : null;
    categories.set(c.id, pai ? `${nameOf(pai)} / ${nameOf(c)}` : nameOf(c));
  }
  return {
    categories,
    merchants: new Map(dump.merchants.map((m) => [m.id, nameOf(m)])),
    accounts: new Map(dump.accounts.map((a) => [a.id, nameOf(a)])),
    cards: new Map(dump.cards.map((c) => [c.id, nameOf(c)])),
  };
}

/**
 * Nome do arquivo.
 *
 * Sem "cofre", sem "financeiro", sem o nome de quem baixou: o arquivo vai
 * parar na pasta de downloads, em backup de nuvem, às vezes num anexo de
 * e-mail. O nome é a única parte que aparece sem abrir — e não precisa
 * anunciar o que tem dentro.
 */
export function backupFileName(geradoEm: Date, extensao: "json" | "csv"): string {
  return `millead-${geradoEm.toISOString().slice(0, 10)}.${extensao}`;
}
