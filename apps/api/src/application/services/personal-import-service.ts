import { createHash } from "node:crypto";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
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
import { parseImportedDate } from "./import-date.js";
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
import { detectCsvSettings, scoreSettings, type Confidence } from "./import-autodetect.js";
import { emptyIdentity, identityFromOfx, type ImportIdentity } from "./import-identity.js";
import {
  matchOrigin,
  suggestOrigin,
  type OriginMatch,
  type SuggestedOrigin,
} from "./import-origin-match.js";
import { describeMerchant } from "./merchant-display.js";
import { guessCategory } from "./category-keywords.js";
import { guessKind, type TransactionKind } from "./transaction-kind.js";
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

/**
 * O que a análise devolve — tudo que o sistema conseguiu ler do arquivo
 * sozinho, antes de a pessoa escolher qualquer coisa.
 *
 * É a peça que inverte o fluxo: antes, escolher a conta vinha primeiro e o
 * arquivo depois; a conta estava escrita dentro do arquivo o tempo todo.
 */
export interface AnalyzedRow extends PreviewRow {
  /** Nome legível. A descrição original continua em `description`. */
  displayName: string;
  merchantHint: string | null;
  personHint: string | null;
  categoryHint: string | null;
  subcategoryHint: string | null;
  /** Sugestão de que é gasto da MilWeb. */
  businessHint: boolean;
  /** COMPRA, TRANSFERENCIA, PAGAMENTO_FATURA, ESTORNO... */
  kind: TransactionKind;
  /** Fora de receita e despesa (transferência própria, fatura, estorno). */
  neutral: boolean;
  installmentNumber: number | null;
  installmentTotal: number | null;
  /** `alta` preenche sozinho; `media` preenche e destaca; `baixa` pede revisão. */
  confidence: Confidence;
}

export interface AnalyzeInput {
  fileName: string;
  content: string;
  /** Opcional: quando a pessoa já escolheu, ou quando o casamento foi exato. */
  accountId?: string | null;
  cardId?: string | null;
  /** Mapeamento corrigido na tela, para reanalisar sem novo upload. */
  settings?: ImportProfileSettings | null;
  profileId?: string | null;
}

export interface AnalyzeResult {
  format: PersonalImportFormat;
  fileHash: string;
  fileName: string;
  /** O que o arquivo declara sobre si — banco, conta, período, saldo. */
  identity: ImportIdentity;
  /** Casamento com o que já está cadastrado. */
  match: OriginMatch;
  /** Formulário pré-preenchido, quando não há correspondência. */
  suggestion: SuggestedOrigin | null;
  /** Só CSV: mapeamento detectado e o que ficou pendente. */
  detection: {
    confidence: Confidence;
    pendencias: string[];
    ignoradas: string[];
    settings: ImportProfileSettings;
  } | null;
  headers: string[];
  delimiter: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  /** Totais do arquivo, para conferir antes de importar. */
  totals: {
    linhas: number;
    entradas: string;
    saidas: string;
    novas: number;
    duplicadas: number;
    jaImportadas: number;
    revisar: number;
    invalidas: number;
    milweb: number;
    neutras: number;
  };
  alreadyImported: boolean;
  rows: AnalyzedRow[];
}

export class PersonalImportService {
  constructor(
    private readonly imports: PersonalImportRepository,
    private readonly transactions: PersonalTransactionRepository,
    private readonly accounts: PersonalAccountRepository,
    private readonly statements: PersonalStatementRepository,
    private readonly classifier: TransactionClassifier,
  ) {}

  // ----- Análise: o arquivo primeiro, a conta depois -----

  /**
   * Lê o arquivo e devolve tudo que dá para saber dele sozinho.
   *
   * ## Por que isto existe
   *
   * O fluxo anterior pedia a conta antes de olhar o arquivo — e a conta está
   * escrita dentro do arquivo. Pedir que a pessoa repita o que o OFX já declara
   * é trabalho que o código faz, e é fonte de erro: escolher a conta errada num
   * seletor associa o extrato ao lugar errado, e isso só aparece meses depois,
   * num saldo que não fecha.
   *
   * ## Ordem das decisões
   *
   * 1. Formato (OFX ou CSV) — pelo conteúdo, nunca pela extensão.
   * 2. Identidade: banco, conta/cartão, tipo, moeda, período, saldo.
   * 3. Casamento com o que já existe. Só preenche sozinho quando a evidência é
   *    única — ver `import-origin-match`.
   * 4. Leitura das linhas, com mapeamento detectado no caso do CSV.
   * 5. Enriquecimento: nome legível, categoria, fornecedor, tipo, parcela.
   * 6. Deduplicação — **só quando a origem já é conhecida**, porque a chave de
   *    duplicidade inclui a conta. Sem origem, a coluna fica vazia em vez de
   *    afirmar que está tudo novo.
   *
   * Nada aqui grava: é leitura pura sobre o texto que veio na requisição.
   */
  async analyze(vaultId: string, input: AnalyzeInput): Promise<AnalyzeResult> {
    const fileHash = sha256(input.content);
    const format = detectFormat(input.content);
    const fileName = sanitizeFileName(input.fileName);

    const identity = format === "OFX" ? identityFromOfx(input.content) : emptyIdentity();

    const [accounts, cards] = await Promise.all([
      this.accounts.listAccounts(vaultId, false),
      this.accounts.listCards(vaultId, false),
    ]);
    const candidatos = (
      lista: ReadonlyArray<{
        id: string;
        name: string;
        institution: string | null;
        last4: string | null;
      }>,
    ) => lista.map((c) => ({ id: c.id, name: c.name, institution: c.institution, last4: c.last4 }));

    const match = matchOrigin(identity, candidatos(accounts), candidatos(cards));

    // A escolha da pessoa ganha do casamento automático, sempre.
    const escolhida = input.accountId ?? input.cardId ?? null;
    const accountId = input.accountId ?? (match.kind === "account" ? match.selectedId : null);
    const cardId = input.cardId ?? (match.kind === "card" ? match.selectedId : null);
    const sourceId = accountId ?? cardId;

    const lido =
      format === "OFX" ? this.readOfx(input.content) : await this.readCsv(vaultId, input);
    const rows = await this.enrich(vaultId, lido.rows, sourceId);

    const datas = rows.flatMap((row) => (row.date ? [row.date.getTime()] : []));
    const anterior = sourceId
      ? await this.imports.findBatchByHash(vaultId, { accountId, cardId }, fileHash)
      : null;

    return {
      format,
      fileHash,
      fileName,
      identity,
      match: escolhida
        ? escolhaExplicita(escolhida, input.accountId ? "account" : "card", [
            ...candidatos(accounts),
            ...candidatos(cards),
          ])
        : match,
      suggestion: match.level === "nenhuma" ? suggestOrigin(identity) : null,
      detection: lido.detection,
      headers: lido.headers,
      delimiter: lido.delimiter,
      // O período declarado no arquivo vale mais que o deduzido das linhas: um
      // mês sem movimentação tem período e não tem data nenhuma.
      periodStart:
        parseImportedDate(identity.periodStart ?? "", "YMD") ??
        (datas.length ? new Date(Math.min(...datas)) : null),
      periodEnd:
        parseImportedDate(identity.periodEnd ?? "", "YMD") ??
        (datas.length ? new Date(Math.max(...datas)) : null),
      totals: totalsOf(rows),
      alreadyImported: anterior !== null,
      rows,
    };
  }

  /**
   * Acrescenta a cada linha o que dá para inferir sem gravar nada.
   *
   * A deduplicação só entra quando a origem é conhecida: a chave inclui a
   * conta, e calculá-la sem ela produziria uma chave que não corresponde a
   * nada — e toda linha pareceria nova.
   */
  private async enrich(
    vaultId: string,
    rows: MappedRow[],
    sourceId: string | null,
  ): Promise<AnalyzedRow[]> {
    const comChave = rows.map((row) => ({
      ...row,
      fingerprint: sourceId ? fingerprintFor(row, sourceId) : null,
      amount: row.amountCents === null ? null : formatMoney(row.amountCents),
    }));

    // Sem origem, a deduplicação não roda -- e é por isso que o status não pode
    // sair dela. `classifyImportRows` marca INVALID toda linha sem fingerprint,
    // e sem conta NENHUMA linha tem fingerprint: o arquivo inteiro apareceria
    // como recusado, com totais zerados, antes mesmo de a pessoa escolher a
    // conta. O que a linha é (válida ou não) depende só dos erros de leitura;
    // se ela já existe no Cofre é outra pergunta, e essa só tem resposta com a
    // conta em mãos.
    const statuses = sourceId
      ? classifyImportRows(
          comChave,
          await this.transactions.findExistingFingerprints(
            vaultId,
            comChave.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])),
          ),
        )
      : comChave.map((row): ImportRowStatus => (row.errors.length > 0 ? "INVALID" : "NEW"));

    return comChave.map((row, index) => {
      const merchant = describeMerchant(row.description);
      const categoria = guessCategory(row.description);
      const tipo = guessKind(row.description, null);

      return {
        ...row,
        status: statuses[index]!,
        displayName: merchant.name,
        merchantHint: merchant.merchantHint,
        personHint: merchant.personHint,
        categoryHint: categoria?.category ?? null,
        subcategoryHint: categoria?.subcategory ?? null,
        businessHint: categoria?.business ?? false,
        kind: tipo.kind,
        neutral: tipo.neutral,
        installmentNumber: merchant.installment?.number ?? null,
        installmentTotal: merchant.installment?.total ?? null,
        confidence: rowConfidence(categoria?.confidence, tipo.confidence),
      };
    });
  }

  private readOfx(content: string) {
    return { ...this.previewOfx(content), detection: null };
  }

  /**
   * Lê o CSV escolhendo o melhor mapeamento disponível.
   *
   * A ordem é: o que a pessoa corrigiu na tela > perfil salvo **que funciona
   * neste arquivo** > detecção automática.
   *
   * O perfil salvo é conferido antes de valer, e isso importa: um modelo do
   * Nubank aplicado a um extrato do Itaú produziria linhas inválidas em
   * silêncio, e a pessoa conferiria linha a linha um problema que é do
   * mapeamento inteiro. Ler vinte linhas para descobrir isso é barato.
   */
  private async readCsv(vaultId: string, input: AnalyzeInput) {
    assertNotMarkup(input.content);
    const doc = parseCsv(input.content, input.settings?.delimiter);
    if (doc.rows.length === 0) throw new ValidationError("Arquivo vazio ou ilegível.");

    const salvo = await this.resolveSettings(vaultId, {
      fileName: input.fileName,
      content: input.content,
      accountId: input.accountId ?? null,
      cardId: input.cardId ?? null,
      profileId: input.profileId ?? null,
      settings: null,
    });
    const detectado = detectCsvSettings(doc);

    if (input.settings) {
      assertMappingMatchesHeader(doc.rows[0] ?? [], input.settings);
      return {
        headers: doc.rows[0] ?? [],
        delimiter: doc.delimiter,
        rows: mapCsvRows(doc, input.settings),
        detection: {
          confidence: "alta" as const,
          pendencias: [],
          ignoradas: [],
          settings: input.settings,
        },
      };
    }

    if (salvo && scoreSettings(doc, salvo) >= 0.8) {
      assertMappingMatchesHeader(doc.rows[0] ?? [], salvo);
      return {
        headers: doc.rows[0] ?? [],
        delimiter: doc.delimiter,
        rows: mapCsvRows(doc, salvo),
        detection: {
          confidence: "alta" as const,
          pendencias: [],
          ignoradas: [],
          settings: salvo,
        },
      };
    }

    if (detectado) {
      assertMappingMatchesHeader(doc.rows[0] ?? [], detectado.settings);
      const linhas = mapCsvRows(doc, detectado.settings);
      assertLegivel(linhas);
      return {
        headers: doc.rows[0] ?? [],
        delimiter: doc.delimiter,
        rows: linhas,
        detection: {
          confidence: detectado.confidence,
          pendencias: detectado.pendencias,
          ignoradas: detectado.ignoradas,
          settings: detectado.settings,
        },
      };
    }

    // Nem detecção nem perfil: a tela mostra as colunas e pergunta.
    return {
      headers: doc.rows[0] ?? [],
      delimiter: doc.delimiter,
      rows: [] as MappedRow[],
      detection: null,
    };
  }

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
      // A assinatura é resolvida pela classificação, logo depois -- aqui a
      // linha ainda é só o que o banco mandou.
      subscriptionId: null,
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

  /**
   * Histórico, com quantas movimentações de cada importação ainda existem.
   *
   * `importedRows` é fato histórico do dia em que aconteceu e não muda. Se as
   * movimentações forem apagadas depois, ele continua dizendo 17 e passa a
   * mentir. `linkedTransactions` é o número de agora — e é ele que diz o que
   * um "desfazer" levaria junto.
   */
  async listBatches(
    vaultId: string,
    limit: number,
  ): Promise<Array<PersonalImportBatch & { linkedTransactions: number }>> {
    const lotes = await this.imports.listBatches(vaultId, limit);
    const contagens = await this.imports.countLinkedTransactions(
      vaultId,
      lotes.map((l) => l.id),
    );
    return lotes.map((lote) => ({
      ...lote,
      linkedTransactions: contagens.get(lote.id) ?? 0,
    }));
  }

  /**
   * Desfaz uma importação: apaga as movimentações que vieram dela e o registro.
   *
   * ## Por que os dois juntos
   *
   * Apagar só o registro deixaria as movimentações órfãs, sem nada dizendo de
   * onde vieram. Apagar só as movimentações deixaria um registro dizendo "17
   * de 17 importadas" com zero no Cofre — foi exatamente esse estado que fez
   * esta função existir.
   *
   * A contagem vem antes, na listagem, para você ver o que vai embora. Um lote
   * com zero movimentações restantes é só um registro velho, e some sem levar
   * nada junto.
   *
   * ## O que ela recusa
   *
   * Movimentação que baixa uma dívida ou que já virou despesa da MilWeb tem FK
   * `Restrict`: o banco recusaria e o erro subiria como 500. A checagem vem
   * antes e nomeia o que está no caminho — desfazer uma importação não pode
   * arrastar consigo um lançamento que outro módulo depende.
   */
  async undoImport(vaultId: string, batchId: string): Promise<{ removidas: number }> {
    const lote = await this.imports.findBatch(vaultId, batchId);
    if (!lote) throw new NotFoundError("Importação não encontrada.");

    const bloqueadas = await this.imports.findBlockedTransactions(vaultId, batchId);
    if (bloqueadas.length > 0) {
      const divida = bloqueadas.filter((b) => b.motivo === "divida").length;
      const milweb = bloqueadas.filter((b) => b.motivo === "milweb").length;
      const partes = [
        divida > 0 && `${divida} ${divida === 1 ? "baixa uma dívida" : "baixam dívidas"}`,
        milweb > 0 &&
          `${milweb} já ${milweb === 1 ? "virou despesa" : "viraram despesas"} da MilWeb`,
      ].filter(Boolean);

      throw new ConflictError(
        `Esta importação não pode ser desfeita: ${partes.join(" e ")}. ` +
          "Desfaça esses vínculos primeiro — apagar a movimentação deixaria o outro lado sem lastro.",
      );
    }

    const removidas = await this.imports.deleteBatchWithTransactions(vaultId, batchId);
    return { removidas };
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

/**
 * A confiança de uma linha — o que decide se ela pede revisão.
 *
 * ## O que entra na conta, e o que não
 *
 * Entram **categoria** e **tipo**. Não entra o nome legível do fornecedor, e
 * essa exclusão é deliberada: o nome é cosmético, a descrição original fica
 * sempre à vista ao lado dele, e nenhuma decisão de dinheiro depende dele.
 *
 * A primeira versão incluía o nome, e o resultado foi inútil: "POSTO
 * IPIRANGA" tem categoria certa (Transporte, alta) mas não está na tabela de
 * fornecedores conhecidos, então a linha inteira caía para "baixa". Com quase
 * todo extrato assim, "a revisar" marcava tudo — e uma marcação que aparece em
 * tudo não distingue nada, então ninguém olha.
 *
 * ## Sem categoria é sempre baixa
 *
 * É o caso que realmente pede uma pessoa: o sistema não soube dizer o que a
 * linha é. Entre as categorizadas, vale a menor confiança entre categoria e
 * tipo — preencher com destaque é melhor que preencher e esquecer.
 */
export function rowConfidence(
  categoria: "alta" | "media" | undefined,
  tipo: "alta" | "media",
): Confidence {
  if (categoria === undefined) return "baixa";
  return categoria === "media" || tipo === "media" ? "media" : "alta";
}

/** Os números do cabeçalho da prévia, para conferir antes de importar. */
export function totalsOf(rows: ReadonlyArray<AnalyzedRow>): AnalyzeResult["totals"] {
  let entradas = 0;
  let saidas = 0;

  for (const row of rows) {
    if (row.amountCents === null || row.status === "INVALID") continue;
    // Neutras (transferência própria, fatura, estorno) ficam fora dos dois
    // totais -- é a mesma regra do resumo do mês, e mostrar diferente aqui
    // faria os dois números discordarem na cara da pessoa.
    if (row.neutral) continue;
    if (row.direction === "IN") entradas += row.amountCents;
    else if (row.direction === "OUT") saidas += row.amountCents;
  }

  return {
    linhas: rows.length,
    entradas: formatMoney(entradas),
    saidas: formatMoney(saidas),
    novas: rows.filter((r) => r.status === "NEW").length,
    // As duas duplicidades andam juntas no total, mas a linha diz qual é:
    // "já no Cofre" você esperava; "repetida no arquivo" quase sempre é
    // surpresa.
    duplicadas: rows.filter((r) => r.status === "DUPLICATE_FILE").length,
    jaImportadas: rows.filter((r) => r.status === "DUPLICATE_VAULT").length,
    revisar: rows.filter((r) => r.status !== "INVALID" && r.confidence === "baixa").length,
    invalidas: rows.filter((r) => r.status === "INVALID").length,
    milweb: rows.filter((r) => r.businessHint).length,
    neutras: rows.filter((r) => r.neutral).length,
  };
}

/**
 * O arquivo é uma página web, não um extrato?
 *
 * É o caso mais comum de "arquivo errado": a sessão do banco expira e o
 * download devolve o HTML da tela de login, com o nome `extrato.ofx`. Esse
 * arquivo passa por qualquer checagem de extensão, e o leitor de CSV o engole
 * sem reclamar — vira uma linha só, ou várias inválidas.
 *
 * Falhar aqui, com esta mensagem, é o que separa "o arquivo está errado" de
 * "as linhas estão erradas". Sem isso a pessoa conferiria linha por linha um
 * problema que é do arquivo inteiro.
 */
function assertNotMarkup(content: string): void {
  const inicio = content.trimStart().slice(0, 200).toLowerCase();
  if (inicio.startsWith("<!doctype") || inicio.startsWith("<html") || inicio.startsWith("<?xml")) {
    throw new ValidationError(
      "Este arquivo é uma página web, não um extrato. Isso costuma acontecer quando a " +
        "sessão do banco expira durante o download — entre de novo e baixe outra vez.",
    );
  }
}

/**
 * O mapeamento produziu alguma linha legível?
 *
 * Um extrato de mês sem movimentação é legítimo: cabeçalho certo, nenhuma
 * linha de dado, resultado vazio. O que não é legítimo é ter linhas e nenhuma
 * delas ser lida — isso significa que o arquivo não tem a forma que aparenta,
 * e é diferente de "algumas linhas com problema".
 */
function assertLegivel(rows: readonly MappedRow[]): void {
  if (rows.length === 0) return;
  if (rows.some((row) => row.errors.length === 0)) return;
  throw new ValidationError(
    "Nenhuma linha deste arquivo pôde ser lida como movimentação. Confira se é mesmo um " +
      "extrato, ou ajuste o mapeamento das colunas.",
  );
}

/**
 * O casamento quando a pessoa escolhe a origem na tela.
 *
 * Sobrescrever só `selectedId` no resultado automático deixava `kind` como
 * veio — e num CSV ele vem `null`, porque o arquivo não diz se é conta ou
 * cartão. A tela usava esse `kind` para montar `accountId`/`cardId`, os dois
 * saíam nulos, e a confirmação respondia "Informe exatamente uma origem" logo
 * depois de a pessoa ter informado. O texto de apoio também continuava
 * pedindo uma escolha já feita.
 *
 * Aqui o `kind` vem de qual campo a pessoa preencheu, que é a informação
 * definitiva: ela escolheu no seletor, não há o que inferir.
 */
export function escolhaExplicita(
  id: string,
  kind: "account" | "card",
  candidatos: ReadonlyArray<{
    id: string;
    name: string;
    institution: string | null;
    last4: string | null;
  }>,
): OriginMatch {
  const escolhido = candidatos.find((c) => c.id === id);
  const rotulo = kind === "card" ? "cartão" : "conta";

  return {
    level: "exata",
    kind,
    selectedId: id,
    candidates: escolhido ? [escolhido] : [],
    reason: escolhido
      ? `Você escolheu ${rotulo === "conta" ? "a conta" : "o cartão"} "${escolhido.name}".`
      : `Você escolheu ${rotulo === "conta" ? "uma conta" : "um cartão"}.`,
  };
}
