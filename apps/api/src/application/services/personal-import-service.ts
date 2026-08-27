import { createHash } from "node:crypto";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalAccountRepository } from "../../domain/repositories/personal-account-repository.js";
import type {
  CreateImportProfileInput,
  PersonalImportBatch,
  PersonalImportFormat,
  PersonalImportProfile,
  PersonalImportRepository,
  SafeImportError,
  UpdateImportProfileInput,
} from "../../domain/repositories/personal-import-repository.js";
import type { PersonalStatementRepository } from "../../domain/repositories/personal-statement-repository.js";
import type { TransactionClassifier } from "../../domain/services/transaction-classifier.js";
import type {
  CreateTransactionInput,
  PersonalTransactionRepository,
} from "../../domain/repositories/personal-transaction-repository.js";
import { parseCsv } from "./import-csv.js";
import {
  classifyImportRows,
  summarizeClassification,
  type ImportRowStatus,
} from "./import-dedup.js";
import {
  mapCsvRows,
  mapOfxTransactions,
  type ImportProfileSettings,
  type MappedRow,
} from "./import-mapper.js";
import { parseOfx } from "./import-ofx.js";
import { resolveStatementPeriod } from "./statement-period.js";
import { buildFingerprint } from "./transaction-fingerprint.js";
import { normalizeDescription } from "./transaction-text.js";
import { parseUtcDate } from "./vault-date.js";
import { formatMoney } from "./vault-money.js";

/**
 * Importação de extrato: pré-visualizar e confirmar.
 *
 * **O arquivo nunca é guardado.** Nem em disco, nem em storage, nem numa
 * tabela de rascunho entre os dois passos: a pré-visualização devolve as
 * linhas já interpretadas, e a confirmação manda de volta as que você aceitou.
 *
 * Isso é uma decisão de privacidade com uma consequência de engenharia
 * explícita: **o servidor não confia no que volta**. Fingerprint é recalculado,
 * duplicatas são reconferidas contra o banco no momento da gravação, e a
 * origem é revalidada como sua. O que o cliente devolve é a SELEÇÃO, não a
 * verdade.
 *
 * A alternativa — guardar o arquivo (ou as linhas) entre os passos — pediria
 * um lugar pra estado temporário que é justamente o dado mais sensível do
 * Cofre, com prazo de validade e limpeza pra manter. Não vale.
 */

export interface ImportOrigin {
  accountId: string | null;
  cardId: string | null;
}

export interface PreviewImportInput extends ImportOrigin {
  fileName: string;
  /** Conteúdo em texto. Já decodificado pelo controller. */
  content: string;
  /** Perfil salvo, ou configuração avulsa. Ignorado em OFX. */
  profileId?: string | null;
  settings?: ImportProfileSettings | null;
}

export interface PreviewRow extends MappedRow {
  status: ImportRowStatus;
  fingerprint: string | null;
  /** Valor formatado, pronto pra confirmação. */
  amount: string | null;
}

export interface ImportPreview {
  format: PersonalImportFormat;
  fileHash: string;
  fileName: string;
  /** Só em CSV sem perfil: as colunas encontradas, pra você mapear na tela. */
  needsMapping: boolean;
  headers: string[];
  delimiter: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  summary: ReturnType<typeof summarizeClassification>;
  /** True quando este mesmo arquivo já foi importado nesta origem. */
  alreadyImported: boolean;
  rows: PreviewRow[];
}

export interface ConfirmImportRow {
  line: number;
  date: string;
  description: string;
  amount: string;
  direction: "IN" | "OUT";
  externalId: string | null;
}

export interface ConfirmImportInput extends ImportOrigin {
  fileName: string;
  fileHash: string;
  format: PersonalImportFormat;
  rows: ConfirmImportRow[];
  /** Linhas que a pré-visualização recusou, pra registrar no lote. */
  ignored: SafeImportError[];
}

export class PersonalImportService {
  constructor(
    private readonly imports: PersonalImportRepository,
    private readonly transactions: PersonalTransactionRepository,
    private readonly accounts: PersonalAccountRepository,
    private readonly statements: PersonalStatementRepository,
    private readonly classifier: TransactionClassifier,
  ) {}

  // ----- Pré-visualização -----

  async preview(vaultId: string, input: PreviewImportInput): Promise<ImportPreview> {
    const origin = await this.resolveOrigin(vaultId, input);
    const fileHash = sha256(input.content);
    const format = detectFormat(input.content);

    const parsed =
      format === "OFX" ? this.previewOfx(input.content) : await this.previewCsv(vaultId, input);

    if (parsed.needsMapping) {
      return {
        format,
        fileHash,
        fileName: sanitizeFileName(input.fileName),
        needsMapping: true,
        headers: parsed.headers,
        delimiter: parsed.delimiter,
        periodStart: null,
        periodEnd: null,
        summary: summarizeClassification([]),
        alreadyImported: false,
        rows: [],
      };
    }

    const rows = parsed.rows.map((row) => ({
      ...row,
      fingerprint: fingerprintFor(row, origin.sourceId),
      amount: row.amountCents === null ? null : formatMoney(row.amountCents),
    }));

    const existing = await this.transactions.findExistingFingerprints(
      vaultId,
      rows.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])),
    );
    const statuses = classifyImportRows(rows, existing);

    const dates = rows.flatMap((row) => (row.date ? [row.date.getTime()] : []));
    const previous = await this.imports.findBatchByHash(vaultId, input, fileHash);

    return {
      format,
      fileHash,
      fileName: sanitizeFileName(input.fileName),
      needsMapping: false,
      headers: parsed.headers,
      delimiter: parsed.delimiter,
      periodStart: dates.length ? new Date(Math.min(...dates)) : null,
      periodEnd: dates.length ? new Date(Math.max(...dates)) : null,
      summary: summarizeClassification(statuses),
      alreadyImported: previous !== null,
      rows: rows.map((row, index) => ({ ...row, status: statuses[index]! })),
    };
  }

  private previewOfx(content: string) {
    const doc = parseOfx(content);
    if (!doc) {
      // Arquivo que não é OFX (login expirado devolvendo HTML é o caso mais
      // comum). Falhar aqui, com mensagem clara, é melhor que produzir zero
      // linhas e deixar você achar que o extrato estava vazio.
      throw new ValidationError(
        "Arquivo não reconhecido como OFX. Confira se o download do banco completou.",
      );
    }
    return {
      needsMapping: false as const,
      headers: [],
      delimiter: null,
      rows: mapOfxTransactions(doc),
    };
  }

  private async previewCsv(vaultId: string, input: PreviewImportInput) {
    const settings = await this.resolveSettings(vaultId, input);
    const doc = parseCsv(input.content, settings?.delimiter);

    if (doc.rows.length === 0) {
      throw new ValidationError("Arquivo vazio ou ilegível.");
    }

    // Sem perfil, a tela precisa das colunas pra você mapear. Não dá pra
    // adivinhar qual coluna é a data: banco nenhum concorda no nome.
    if (!settings) {
      return {
        needsMapping: true as const,
        headers: doc.rows[0] ?? [],
        delimiter: doc.delimiter,
        rows: [] as MappedRow[],
      };
    }

    // Confere o mapeamento CONTRA O CABEÇALHO antes de ler linha nenhuma.
    //
    // É o que separa dois problemas que pareceriam o mesmo: "o arquivo não é um
    // extrato" (a página de sessão expirada do banco é HTML e passa pelo leitor
    // de CSV sem reclamar, virando uma linha só) e "o mapeamento aponta pra
    // coluna errada". Sem esta checagem, os dois viriam como zero linhas ou
    // como N linhas inválidas, e você conferiria linha por linha um problema
    // que é do arquivo inteiro.
    //
    // Feito aqui, e não dentro do mapeamento, porque um extrato de mês sem
    // movimentação é legítimo: cabeçalho certo e nenhuma linha é resultado
    // vazio, não erro.
    assertMappingMatchesHeader(doc.rows[0] ?? [], settings);

    const rows = mapCsvRows(doc, settings);

    return {
      needsMapping: false as const,
      headers: doc.rows[0] ?? [],
      delimiter: doc.delimiter,
      rows,
    };
  }

  // ----- Confirmação -----

  async confirm(vaultId: string, input: ConfirmImportInput): Promise<PersonalImportBatch> {
    const origin = await this.resolveOrigin(vaultId, input);

    // Tudo é recalculado aqui. O cliente escolheu QUAIS linhas entram; ele não
    // decide o que elas são.
    const candidates = input.rows.map((row) => {
      const date = parseIsoDate(row.date);
      return {
        line: row.line,
        row,
        date,
        fingerprint: buildFingerprint({
          sourceId: origin.sourceId,
          externalId: row.externalId,
          transactionDate: date,
          amountBrl: row.amount,
          direction: row.direction,
          normalizedDescription: normalizeDescription(row.description),
        }),
      };
    });

    const existing = await this.transactions.findExistingFingerprints(
      vaultId,
      candidates.map((candidate) => candidate.fingerprint),
    );
    const statuses = classifyImportRows(
      candidates.map((candidate) => ({
        line: candidate.line,
        fingerprint: candidate.fingerprint,
        errors: [],
      })),
      existing,
    );

    const novas = candidates.filter((_, index) => statuses[index] === "NEW");
    const duplicadas = candidates.length - novas.length;

    // Faturas resolvidas ANTES de montar as linhas: um `await` por linha dentro
    // do laço faria uma consulta por movimentação, e um extrato de cartão tem
    // dezenas delas caindo na mesma fatura.
    const statementByRow = await this.resolveStatements(
      vaultId,
      origin,
      novas.map((n) => n.date),
    );

    const totalRows = input.rows.length + input.ignored.length;
    const periodo = periodOf(candidates.map((candidate) => candidate.date));

    // O lote nasce antes porque as movimentações precisam do id dele. As
    // contagens reais só existem depois da inserção -- ver `updateBatchResult`.
    const batch = await this.imports.createBatch(vaultId, {
      accountId: input.accountId,
      cardId: input.cardId,
      format: input.format,
      fileHash: input.fileHash,
      fileName: sanitizeFileName(input.fileName),
      periodStart: periodo.start,
      periodEnd: periodo.end,
      totalRows,
      importedRows: 0,
      duplicateRows: duplicadas,
      ignoredRows: input.ignored.length,
      status: "FAILED",
      errors: input.ignored,
    });

    const toCreate: CreateTransactionInput[] = novas.map((candidate, index) => ({
      accountId: input.accountId,
      cardId: input.cardId,
      transactionDate: candidate.date,
      // Extrato bancário reporta o que já compensou; o de cartão, não. Só a
      // conta ganha data de caixa aqui.
      settlementDate: input.accountId ? candidate.date : null,
      originalDescription: candidate.row.description,
      normalizedDescription: normalizeDescription(candidate.row.description),
      merchantId: null,
      categoryId: null,
      direction: candidate.row.direction,
      amount: candidate.row.amount,
      currency: "BRL",
      originalAmount: null,
      originalCurrency: null,
      amountBrl: candidate.row.amount,
      source: input.format,
      importBatchId: batch.id,
      externalId: candidate.row.externalId,
      fingerprint: candidate.fingerprint,
      // Nasce PENDENTE: a linha veio do banco, mas ainda não passou pela sua
      // revisão de categoria. Quem confirma é a fase 4.
      status: "PENDING",
      note: null,
      statementId: statementByRow[index] ?? null,
      installmentNumber: null,
      installmentTotal: null,
      isTransfer: false,
    }));

    const inserted = await this.transactions.createManyFromImport(vaultId, toCreate);

    // Recalcula as faturas tocadas -- o total nunca é incrementado.
    for (const statementId of new Set(statementByRow.filter((id): id is string => id !== null))) {
      const total = await this.transactions.sumByStatement(vaultId, statementId);
      await this.statements.updateTotal(vaultId, statementId, total);
    }

    // Classifica o que acabou de entrar. Best-effort: a importação já
    // aconteceu, e uma falha aqui não pode desfazê-la -- as linhas ficam
    // PENDING e uma nova passada resolve.
    if (inserted > 0) {
      await this.classifier.runForBatch(vaultId, batch.id).catch(() => undefined);
    }

    const updated = await this.imports.updateBatchResult(vaultId, batch.id, {
      importedRows: inserted,
      // `createMany` com skipDuplicates pode ter pulado linhas que entraram
      // por outro caminho entre a conferência e agora -- essas contam como
      // duplicata, senão o histórico diria que importou o que não importou.
      duplicateRows: duplicadas + (toCreate.length - inserted),
      ignoredRows: input.ignored.length,
      status: resolveStatus(inserted, totalRows),
    });

    return updated ?? batch;
  }

  /** Fatura de cada data, com uma consulta por mês de referência (não por linha). */
  private async resolveStatements(
    vaultId: string,
    origin: ResolvedOrigin,
    dates: Date[],
  ): Promise<Array<string | null>> {
    if (origin.kind !== "card") return dates.map(() => null);

    const cache = new Map<string, string>();
    const result: Array<string | null> = [];

    for (const date of dates) {
      const period = resolveStatementPeriod({
        purchaseDate: date,
        closingDay: origin.closingDay,
        dueDay: origin.dueDay,
      });
      const key = period.referenceMonth.toISOString();

      let statementId = cache.get(key);
      if (!statementId) {
        const statement = await this.statements.ensureForPeriod(vaultId, {
          cardId: origin.sourceId,
          ...period,
        });
        statementId = statement.id;
        cache.set(key, statementId);
      }
      result.push(statementId);
    }

    return result;
  }

  // ----- Histórico e perfis -----

  listBatches(vaultId: string, limit: number): Promise<PersonalImportBatch[]> {
    return this.imports.listBatches(vaultId, limit);
  }

  listProfiles(vaultId: string): Promise<PersonalImportProfile[]> {
    return this.imports.listProfiles(vaultId);
  }

  createProfile(vaultId: string, input: CreateImportProfileInput): Promise<PersonalImportProfile> {
    return this.imports.createProfile(vaultId, input);
  }

  async updateProfile(
    vaultId: string,
    id: string,
    patch: UpdateImportProfileInput,
  ): Promise<PersonalImportProfile> {
    const updated = await this.imports.updateProfile(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Modelo de importação não encontrado.");
    return updated;
  }

  async deleteProfile(vaultId: string, id: string): Promise<void> {
    const deleted = await this.imports.deleteProfile(vaultId, id);
    if (!deleted) throw new NotFoundError("Modelo de importação não encontrado.");
  }

  // ----- Apoio -----

  private async resolveOrigin(
    vaultId: string,
    origin: ImportOrigin,
  ): Promise<
    | { kind: "account"; sourceId: string }
    | { kind: "card"; sourceId: string; closingDay: number; dueDay: number }
  > {
    if ((origin.accountId === null) === (origin.cardId === null)) {
      throw new ValidationError("Informe exatamente uma origem: conta ou cartão.");
    }

    if (origin.accountId) {
      const account = await this.accounts.findAccount(vaultId, origin.accountId);
      if (!account) throw new ValidationError("Conta não encontrada neste Cofre.");
      return { kind: "account", sourceId: account.id };
    }

    const card = await this.accounts.findCard(vaultId, origin.cardId!);
    if (!card) throw new ValidationError("Cartão não encontrado neste Cofre.");
    return { kind: "card", sourceId: card.id, closingDay: card.closingDay, dueDay: card.dueDay };
  }

  private async resolveSettings(
    vaultId: string,
    input: PreviewImportInput,
  ): Promise<ImportProfileSettings | null> {
    if (input.settings) return input.settings;
    if (!input.profileId) return null;

    const profile = await this.imports.findProfile(vaultId, input.profileId);
    if (!profile) throw new NotFoundError("Modelo de importação não encontrado.");

    return {
      delimiter: profile.delimiter,
      decimalSeparator: profile.decimalSeparator === "." ? "." : ",",
      dateOrder: profile.dateOrder === "MDY" ? "MDY" : profile.dateOrder === "YMD" ? "YMD" : "DMY",
      hasHeader: profile.hasHeader,
      invertSign: profile.invertSign,
      // O columnMap vem do banco como Json solto; o shape é garantido pelo DTO
      // na gravação do perfil, não pelo tipo do Prisma.
      columnMap: profile.columnMap as unknown as ImportProfileSettings["columnMap"],
    };
  }
}

function fingerprintFor(row: MappedRow, sourceId: string): string | null {
  if (row.errors.length > 0 || !row.date || row.amountCents === null || !row.direction) return null;
  return buildFingerprint({
    sourceId,
    externalId: row.externalId,
    transactionDate: row.date,
    amountBrl: formatMoney(row.amountCents),
    direction: row.direction,
    normalizedDescription: row.normalizedDescription,
  });
}

function resolveStatus(inserted: number, total: number): "COMPLETED" | "PARTIAL" | "FAILED" {
  if (inserted === 0) return "FAILED";
  return inserted === total ? "COMPLETED" : "PARTIAL";
}

function detectFormat(content: string): PersonalImportFormat {
  // OFX se declara; o resto é tratado como CSV e falha na leitura se não for.
  return content.includes("<OFX") || content.includes("OFXHEADER") ? "OFX" : "CSV";
}

/** SHA-256 do conteúdo — serve só pra reconhecer o mesmo arquivo reenviado. */
function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Nome de arquivo seguro: sem caminho, sem caractere de controle, curto.
 * O nome original de um extrato costuma trazer agência e conta.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "extrato";
  return (
    base
      .replace(/[^\p{L}\p{N}._-]+/gu, "_")
      .replace(/_{2,}/g, "_")
      .slice(0, 120) || "extrato"
  );
}

/** Origem já resolvida e confirmada como deste Cofre. */
type ResolvedOrigin =
  | { kind: "account"; sourceId: string }
  | { kind: "card"; sourceId: string; closingDay: number; dueDay: number };

/** `AAAA-MM-DD` -> meia-noite UTC. Ver `vault-date.ts` sobre o deslize de dia. */
function parseIsoDate(value: string): Date {
  const parsed = parseUtcDate(value);
  if (!parsed) throw new ValidationError(`Data inválida na linha enviada: ${value}`);
  return parsed;
}

function periodOf(dates: Date[]): { start: Date | null; end: Date | null } {
  if (dates.length === 0) return { start: null, end: null };
  const times = dates.map((date) => date.getTime());
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) };
}

/**
 * Toda coluna do mapeamento existe no cabeçalho? Índices numéricos são
 * checados contra a largura da linha; nomes, contra o cabeçalho normalizado
 * (sem acento, sem caixa) -- "Histórico" e "HISTORICO" são a mesma coluna.
 */
function assertMappingMatchesHeader(header: string[], settings: ImportProfileSettings): void {
  if (!settings.hasHeader) return;

  const disponiveis = new Set(header.map((name) => normalizeDescription(name)));
  const faltando: string[] = [];

  for (const [campo, coluna] of Object.entries(settings.columnMap)) {
    if (coluna === undefined) continue;
    const existe =
      typeof coluna === "number"
        ? coluna < header.length
        : disponiveis.has(normalizeDescription(coluna));
    if (!existe) faltando.push(`${campo} -> "${coluna}"`);
  }

  if (faltando.length > 0) {
    throw new ValidationError(
      `Colunas não encontradas no arquivo: ${faltando.join(", ")}. ` +
        "Confira o mapeamento — ou se o arquivo enviado é mesmo o extrato.",
    );
  }
}
