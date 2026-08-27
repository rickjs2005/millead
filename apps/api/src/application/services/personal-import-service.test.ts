import { beforeEach, describe, expect, it } from "vitest";
import { confirmImportSchema } from "../dto/personal-import.dto.js";
import type {
  PersonalAccount,
  PersonalCreditCard,
  PersonalStatement,
  PersonalTransaction,
} from "../../domain/entities/personal-finance.js";
import { ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalAccountRepository } from "../../domain/repositories/personal-account-repository.js";
import type {
  CreateImportBatchInput,
  PersonalImportBatch,
  PersonalImportRepository,
} from "../../domain/repositories/personal-import-repository.js";
import type { PersonalStatementRepository } from "../../domain/repositories/personal-statement-repository.js";
import type {
  CreateTransactionInput,
  PersonalTransactionRepository,
} from "../../domain/repositories/personal-transaction-repository.js";
import { PersonalImportService, sanitizeFileName } from "./personal-import-service.js";
import type { ImportProfileSettings } from "./import-mapper.js";
import { formatUtcDate } from "./vault-date.js";

const VAULT = "vault-1";

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTRS>
<CURDEF>BRL
<BANKTRANLIST>
<DTSTART>20260801
<DTEND>20260831
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805<TRNAMT>-120.00<FITID>F1<MEMO>ANTHROPIC CLAUDE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260810<TRNAMT>2500.00<FITID>F2<MEMO>SALARIO</STMTTRN>
</BANKTRANLIST></STMTRS></BANKMSGSRSV1></OFX>`;

const CSV = `Data;Histórico;Valor
27/08/2026;MERCADO SAO JOAO;-1.234,56
28/08/2026;IFOOD *IFD;-45,90`;

const settingsBr: ImportProfileSettings = {
  delimiter: ";",
  decimalSeparator: ",",
  dateOrder: "DMY",
  hasHeader: true,
  invertSign: false,
  columnMap: { date: "Data", description: "Histórico", amount: "Valor" },
};

function makeFakes(
  over: {
    institution?: string | null;
    last4?: string | null;
    /** Movimentações que não podem ser apagadas — dívida ou MilWeb. */
    bloqueadas?: Array<{ description: string; motivo: "divida" | "milweb" }>;
  } = {},
) {
  const bloqueadas = over.bloqueadas ?? [];
  const account: PersonalAccount = {
    id: "acc-1",
    vaultId: VAULT,
    name: "Conta",
    institution: over.institution ?? null,
    type: "CHECKING",
    currency: "BRL",
    last4: over.last4 ?? null,
    reportedBalance: null,
    reportedBalanceAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const card: PersonalCreditCard = {
    id: "card-1",
    vaultId: VAULT,
    name: "Cartão",
    institution: null,
    last4: null,
    limitAmount: null,
    closingDay: 10,
    dueDay: 17,
    paymentAccountId: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const transactions: PersonalTransaction[] = [];
  const statements: PersonalStatement[] = [];
  const batches: PersonalImportBatch[] = [];
  let seq = 0;

  const accounts: PersonalAccountRepository = {
    listAccounts: async () => [account],
    findAccount: async (_v, id) => (id === account.id ? account : null),
    createAccount: async () => account,
    updateAccount: async () => null,
    deleteAccount: async () => true,
    listCards: async () => [card],
    findCard: async (_v, id) => (id === card.id ? card : null),
    createCard: async () => card,
    updateCard: async () => null,
    deleteCard: async () => true,
  };

  const transactionRepo: PersonalTransactionRepository = {
    list: async () => ({ items: transactions, total: transactions.length }),
    findById: async (_v, id) => transactions.find((t) => t.id === id) ?? null,
    listSplitsFor: async () => new Map(),
    create: async () => {
      throw new Error("não usado na importação");
    },
    update: async () => null,
    delete: async () => true,
    linkTransferPair: async () => undefined,
    replaceSplits: async () => true,
    createManyFromImport: async (_v, rows: CreateTransactionInput[]) => {
      const existentes = new Set(
        transactions.flatMap((t) => (t.fingerprint ? [t.fingerprint] : [])),
      );
      let count = 0;
      for (const row of rows) {
        if (row.fingerprint && existentes.has(row.fingerprint)) continue;
        if (row.fingerprint) existentes.add(row.fingerprint);
        transactions.push({
          id: `tx-${++seq}`,
          vaultId: VAULT,
          transferPairId: null,
          settlesDebtId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...row,
        });
        count++;
      }
      return count;
    },
    findClassificationByExternalId: async () => null,
    listClassificationHistory: async () => [],
    findExistingFingerprints: async (_v, fps) =>
      new Set(fps.filter((fp) => transactions.some((t) => t.fingerprint === fp))),
    listForPeriod: async () => [],
    listWithBusinessSplits: async () => [],
    sumByStatement: async () => "0",
  };

  const statementRepo: PersonalStatementRepository = {
    list: async () => statements,
    findById: async (_v, id) => statements.find((s) => s.id === id) ?? null,
    ensureForPeriod: async (_v, input) => {
      const key = formatUtcDate(input.referenceMonth);
      const found = statements.find(
        (s) => s.cardId === input.cardId && formatUtcDate(s.referenceMonth) === key,
      );
      if (found) return found;
      const created: PersonalStatement = {
        id: `st-${key}`,
        vaultId: VAULT,
        cardId: input.cardId,
        referenceMonth: input.referenceMonth,
        closingDate: input.closingDate,
        dueDate: input.dueDate,
        totalAmount: "0.00",
        paidAmount: "0.00",
        status: "OPEN",
      };
      statements.push(created);
      return created;
    },
    updateTotal: async () => null,
    registerPayment: async () => null,
  };

  const importRepo: PersonalImportRepository = {
    createBatch: async (_v, input: CreateImportBatchInput) => {
      const created: PersonalImportBatch = {
        id: `b-${batches.length + 1}`,
        vaultId: VAULT,
        createdAt: new Date(),
        ...input,
      };
      batches.push(created);
      return created;
    },
    updateBatchResult: async (_v, id, result) => {
      const found = batches.find((b) => b.id === id);
      if (!found) return null;
      Object.assign(found, result);
      return found;
    },
    listBatches: async () => batches,
    findBatch: async (_v, id) => batches.find((b) => b.id === id) ?? null,
    findBatchByHash: async (_v, origin, hash) =>
      batches.find(
        (b) =>
          b.fileHash === hash && b.accountId === origin.accountId && b.cardId === origin.cardId,
      ) ?? null,
    listProfiles: async () => [],
    findProfile: async () => null,
    createProfile: async () => {
      throw new Error("não usado");
    },
    updateProfile: async () => null,
    countLinkedTransactions: async (_v: string, ids: readonly string[]) =>
      new Map(ids.map((id) => [id, transactions.filter((t) => t.importBatchId === id).length])),
    findBlockedTransactions: async () => bloqueadas,
    deleteBatchWithTransactions: async (_v: string, batchId: string) => {
      const antes = transactions.length;
      for (let i = transactions.length - 1; i >= 0; i--) {
        if (transactions[i]!.importBatchId === batchId) transactions.splice(i, 1);
      }
      const i = batches.findIndex((b) => b.id === batchId);
      if (i >= 0) batches.splice(i, 1);
      return antes - transactions.length;
    },
    deleteProfile: async () => false,
  };

  // Classificador de mentira: a fase 4 tem teste proprio; aqui o que importa e
  // que a importacao dispare a passada e nao quebre se ela falhar.
  const classifierCalls: string[] = [];
  const classifier = {
    runForBatch: async (_v: string, batchId: string) => {
      classifierCalls.push(batchId);
      return { processadas: 0, classificadas: 0, pendentes: 0 };
    },
  };

  const service = new PersonalImportService(
    importRepo,
    transactionRepo,
    accounts,
    statementRepo,
    classifier,
  );
  return { service, transactions, statements, batches, classifierCalls, account, card };
}

let f: ReturnType<typeof makeFakes>;
beforeEach(() => {
  f = makeFakes();
});

const contaOfx = { accountId: "acc-1", cardId: null, fileName: "extrato.ofx", content: OFX };
const contaCsv = { accountId: "acc-1", cardId: null, fileName: "extrato.csv", content: CSV };

describe("pré-visualização de OFX", () => {
  it("lê as linhas e resume o que entraria — sem gravar nada", async () => {
    const preview = await f.service.preview(VAULT, contaOfx);

    expect(preview.format).toBe("OFX");
    expect(preview.needsMapping).toBe(false);
    expect(preview.summary).toEqual({ total: 2, novas: 2, duplicadas: 0, invalidas: 0 });
    // O ponto da pré-visualização: nada foi para o banco ainda.
    expect(f.transactions).toHaveLength(0);
    expect(f.batches).toHaveLength(0);
  });

  it("calcula o período a partir das linhas", async () => {
    const preview = await f.service.preview(VAULT, contaOfx);
    expect(formatUtcDate(preview.periodStart!)).toBe("2026-08-05");
    expect(formatUtcDate(preview.periodEnd!)).toBe("2026-08-10");
  });

  it("higieniza o nome do arquivo — extrato costuma trazer agência e conta no nome", async () => {
    const preview = await f.service.preview(VAULT, {
      ...contaOfx,
      fileName: "C:\\Downloads\\extrato ag 1234 cc 56789-0.ofx",
    });
    expect(preview.fileName).not.toContain("\\");
    expect(preview.fileName).toBe("extrato_ag_1234_cc_56789-0.ofx");
  });
});

describe("pré-visualização de CSV", () => {
  it("sem perfil, pede mapeamento e devolve as colunas", async () => {
    const preview = await f.service.preview(VAULT, contaCsv);

    expect(preview.needsMapping).toBe(true);
    expect(preview.headers).toEqual(["Data", "Histórico", "Valor"]);
    expect(preview.delimiter).toBe(";");
    expect(preview.rows).toEqual([]);
  });

  it("com mapeamento, interpreta as linhas", async () => {
    const preview = await f.service.preview(VAULT, { ...contaCsv, settings: settingsBr });

    expect(preview.needsMapping).toBe(false);
    expect(preview.summary.novas).toBe(2);
    expect(preview.rows[0]).toMatchObject({
      description: "MERCADO SAO JOAO",
      amount: "1234.56",
      direction: "OUT",
    });
  });
});

describe("arquivo inválido", () => {
  it("HTML disfarçado de extrato não vira importação vazia", async () => {
    // Sessão do banco expirada devolve HTML. Produzir "0 linhas" faria você
    // achar que o mês não teve movimentação.
    await expect(
      f.service.preview(VAULT, {
        ...contaCsv,
        content: "<html><body>Sessão expirada</body></html>",
        settings: settingsBr,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("arquivo vazio é recusado", async () => {
    await expect(
      f.service.preview(VAULT, { ...contaCsv, content: "   ", settings: settingsBr }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("mapeamento apontando pra coluna que não existe diz QUAL coluna", async () => {
    await expect(
      f.service.preview(VAULT, {
        ...contaCsv,
        settings: { ...settingsBr, columnMap: { ...settingsBr.columnMap, amount: "Montante" } },
      }),
    ).rejects.toThrow(/Montante/);
  });

  it("mês sem movimentação é resultado vazio, não erro", async () => {
    // Cabeçalho certo e nenhuma linha: legítimo. Tratar como arquivo inválido
    // faria você procurar um problema que não existe.
    const preview = await f.service.preview(VAULT, {
      ...contaCsv,
      content: "Data;Histórico;Valor",
      settings: settingsBr,
    });
    expect(preview.rows).toEqual([]);
    expect(preview.summary.total).toBe(0);
  });

  it("origem que não é deste Cofre é recusada", async () => {
    await expect(
      f.service.preview(VAULT, { ...contaOfx, accountId: "conta-de-outro" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("conta E cartão ao mesmo tempo é recusado", async () => {
    await expect(
      f.service.preview(VAULT, { ...contaOfx, cardId: "card-1" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("confirmação", () => {
  async function confirmarOfx() {
    const preview = await f.service.preview(VAULT, contaOfx);
    return f.service.confirm(VAULT, {
      accountId: "acc-1",
      cardId: null,
      fileName: preview.fileName,
      fileHash: preview.fileHash,
      format: "OFX",
      rows: preview.rows.map((row) => ({
        line: row.line,
        date: formatUtcDate(row.date!),
        description: row.description,
        amount: row.amount!,
        direction: row.direction!,
        externalId: row.externalId,
      })),
      ignored: [],
    });
  }

  it("grava as linhas e registra o lote com as contagens reais", async () => {
    const batch = await confirmarOfx();

    expect(f.transactions).toHaveLength(2);
    expect(batch.importedRows).toBe(2);
    expect(batch.duplicateRows).toBe(0);
    expect(batch.status).toBe("COMPLETED");
  });

  it("dispara a classificação do lote que acabou de entrar", async () => {
    const batch = await confirmarOfx();
    expect(f.classifierCalls).toEqual([batch.id]);
  });

  it("não classifica quando nada entrou", async () => {
    await confirmarOfx();
    f.classifierCalls.length = 0;
    await confirmarOfx(); // tudo duplicata
    expect(f.classifierCalls).toEqual([]);
  });

  it("as linhas importadas nascem PENDENTES, esperando classificação", async () => {
    await confirmarOfx();
    expect(f.transactions.every((t) => t.status === "PENDING")).toBe(true);
  });

  it("guarda a procedência: toda linha aponta pro lote", async () => {
    const batch = await confirmarOfx();
    expect(f.transactions.every((t) => t.importBatchId === batch.id)).toBe(true);
  });

  it("REIMPORTAR o mesmo arquivo não duplica nada", async () => {
    await confirmarOfx();
    const segunda = await confirmarOfx();

    expect(f.transactions).toHaveLength(2);
    expect(segunda.importedRows).toBe(0);
    expect(segunda.duplicateRows).toBe(2);
    expect(segunda.status).toBe("FAILED");
  });

  it("a segunda pré-visualização já mostra tudo como duplicata", async () => {
    await confirmarOfx();
    const preview = await f.service.preview(VAULT, contaOfx);

    expect(preview.summary).toEqual({ total: 2, novas: 0, duplicadas: 2, invalidas: 0 });
    expect(preview.alreadyImported).toBe(true);
  });

  it("linha repetida DENTRO do arquivo entra uma vez só", async () => {
    const repetido = OFX.replace(
      "</BANKTRANLIST>",
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805<TRNAMT>-120.00<FITID>F1<MEMO>ANTHROPIC CLAUDE</STMTTRN></BANKTRANLIST>",
    );
    const preview = await f.service.preview(VAULT, { ...contaOfx, content: repetido });

    expect(preview.summary).toEqual({ total: 3, novas: 2, duplicadas: 1, invalidas: 0 });
  });

  it("registra as linhas recusadas sem guardar o conteúdo do extrato", async () => {
    const preview = await f.service.preview(VAULT, contaOfx);
    const batch = await f.service.confirm(VAULT, {
      accountId: "acc-1",
      cardId: null,
      fileName: preview.fileName,
      fileHash: preview.fileHash,
      format: "OFX",
      rows: [
        {
          line: 1,
          date: "2026-08-05",
          description: "ANTHROPIC CLAUDE",
          amount: "120.00",
          direction: "OUT",
          externalId: "F1",
        },
      ],
      ignored: [{ line: 2, code: "VALOR_INVALIDO" }],
    });

    expect(batch.ignoredRows).toBe(1);
    expect(batch.status).toBe("PARTIAL");
    expect(JSON.stringify(batch.errors)).toBe('[{"line":2,"code":"VALOR_INVALIDO"}]');
  });

  it("importação de cartão liga cada linha na fatura certa", async () => {
    const preview = await f.service.preview(VAULT, {
      accountId: null,
      cardId: "card-1",
      fileName: "fatura.ofx",
      content: OFX,
    });
    await f.service.confirm(VAULT, {
      accountId: null,
      cardId: "card-1",
      fileName: preview.fileName,
      fileHash: preview.fileHash,
      format: "OFX",
      rows: preview.rows.map((row) => ({
        line: row.line,
        date: formatUtcDate(row.date!),
        description: row.description,
        amount: row.amount!,
        direction: row.direction!,
        externalId: row.externalId,
      })),
      ignored: [],
    });

    // Compra de 05/08 e de 10/08, cartão que fecha dia 10: as duas caem na
    // fatura de agosto.
    expect(f.statements).toHaveLength(1);
    expect(f.transactions.every((t) => t.statementId === "st-2026-08-01")).toBe(true);
  });

  it("extrato de conta ganha data de caixa; fatura de cartão, não", async () => {
    await confirmarOfx();
    // A conta reporta o que já compensou.
    expect(f.transactions.every((t) => t.settlementDate !== null)).toBe(true);
  });
});

describe("sanitizeFileName", () => {
  it("tira caminho, caractere estranho e limita o tamanho", () => {
    expect(sanitizeFileName("/var/tmp/extrato.ofx")).toBe("extrato.ofx");
    expect(sanitizeFileName("extrato;rm -rf.csv")).toBe("extrato_rm_-rf.csv");
    expect(sanitizeFileName("x".repeat(300)).length).toBe(120);
  });

  it("nunca devolve string vazia", () => {
    expect(sanitizeFileName("")).toBe("extrato");
    expect(sanitizeFileName("///")).toBe("extrato");
  });
});

describe("análise: o arquivo primeiro, a conta depois", () => {
  const OFX = `OFXHEADER:100
<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Exemplo<FID>260</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>260<ACCTID>1234567-8<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801
<DTEND>20260831
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805<TRNAMT>-120.00<FITID>a1<MEMO>ANTHROPIC CLAUDE AI</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260806<TRNAMT>-45.90<FITID>a2<MEMO>IFOOD*RESTAURANTE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260810<TRNAMT>5000.00<FITID>a3<MEMO>SALARIO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260815<TRNAMT>-800.00<FITID>a4<MEMO>PAGAMENTO DE FATURA CARTAO</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>2450.75<DTASOF>20260831</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

  it("NÃO exige conta: analisa só com o arquivo", async () => {
    // É a mudança de fluxo. Antes, sem conta a chamada nem começava.
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, { fileName: "extrato.ofx", content: OFX });
    expect(r.rows).toHaveLength(4);
  });

  it("lê a identidade que o arquivo declara", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, { fileName: "extrato.ofx", content: OFX });

    expect(r.identity).toMatchObject({
      kind: "account",
      institution: "Banco Exemplo",
      last4: "5678",
      accountType: "CHECKING",
      currency: "BRL",
      balance: "2450.75",
    });
  });

  it("usa o período declarado no arquivo, não o deduzido das linhas", async () => {
    // Um mês sem movimentação tem período e não tem data nenhuma.
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, { fileName: "extrato.ofx", content: OFX });
    expect(r.periodStart?.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(r.periodEnd?.toISOString().slice(0, 10)).toBe("2026-08-31");
  });

  it("casa com a conta cadastrada pelos 4 últimos dígitos", async () => {
    const f = makeFakes({ last4: "5678", institution: "Banco Exemplo" });
    const r = await f.service.analyze(VAULT, { fileName: "extrato.ofx", content: OFX });

    expect(r.match.level).toBe("exata");
    expect(r.match.selectedId).toBe("acc-1");
    expect(r.match.reason).toContain("5678");
  });

  it("sem correspondência, sugere criar com o que o arquivo trouxe", async () => {
    const f = makeFakes({ last4: "0000" });
    const r = await f.service.analyze(VAULT, { fileName: "extrato.ofx", content: OFX });

    expect(r.match.selectedId).toBeNull();
    expect(r.suggestion).toMatchObject({
      kind: "account",
      name: "Banco Exemplo ··5678",
      last4: "5678",
      accountType: "CHECKING",
    });
  });

  it("a escolha da pessoa ganha do casamento automático", async () => {
    const f = makeFakes({ last4: "0000" });
    const r = await f.service.analyze(VAULT, {
      fileName: "extrato.ofx",
      content: OFX,
      accountId: "acc-1",
    });
    expect(r.match.selectedId).toBe("acc-1");
  });

  it("sem origem, a deduplicação fica vazia em vez de mentir", async () => {
    // A chave de duplicidade inclui a conta. Calculada sem ela, não
    // corresponderia a nada e toda linha pareceria nova.
    const f = makeFakes({ last4: "0000" });
    const r = await f.service.analyze(VAULT, { fileName: "extrato.ofx", content: OFX });
    expect(r.rows.every((row) => row.fingerprint === null)).toBe(true);
  });
});

describe("análise: o que ela infere de cada linha", () => {
  const linha = async (memo: string) => {
    const ofx = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM><STMTTRN><DTPOSTED>20260805<TRNAMT>-10.00<FITID>x<MEMO>${memo}</STMTTRN></OFX>`;
    const f = makeFakes({ last4: "1111" });
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: ofx });
    return r.rows[0]!;
  };

  it("nome legível, mantendo a descrição original", async () => {
    const row = await linha("ANTHROPIC CLAUDE AI SUBSCR");
    expect(row.displayName).toBe("Anthropic / Claude");
    expect(row.description).toBe("ANTHROPIC CLAUDE AI SUBSCR");
  });

  it("categoria e classificação MilWeb, com confiança alta", async () => {
    const row = await linha("ANTHROPIC CLAUDE AI");
    expect(row.categoryHint).toBe("Trabalho");
    expect(row.subcategoryHint).toBe("IA");
    expect(row.businessHint).toBe(true);
    expect(row.confidence).toBe("alta");
  });

  it("gasto pessoal não vira MilWeb", async () => {
    const row = await linha("IFOOD*RESTAURANTE DO ZE");
    expect(row.categoryHint).toBe("Alimentação");
    expect(row.businessHint).toBe(false);
  });

  it("pagamento de fatura é marcado como neutro", async () => {
    // Não é despesa nova: a despesa foi a compra no cartão.
    const row = await linha("PAGAMENTO DE FATURA CARTAO");
    expect(row.kind).toBe("PAGAMENTO_FATURA");
    expect(row.neutral).toBe(true);
  });

  it("parcela é extraída sem sumir da descrição", async () => {
    const row = await linha("LOJA MOVEIS PARC 02/10");
    expect(row.installmentNumber).toBe(2);
    expect(row.installmentTotal).toBe(10);
    expect(row.description).toContain("02/10");
  });

  it("o que não reconhece fica com confiança baixa, para revisão", async () => {
    const row = await linha("ESTABELECIMENTO 99887766");
    expect(row.categoryHint).toBeNull();
    expect(row.confidence).toBe("baixa");
  });
});

describe("análise: os totais do cabeçalho", () => {
  it("entradas e saídas não contam o que é neutro", async () => {
    // Mesma regra do resumo do mês. Números diferentes nas duas telas fariam a
    // pessoa desconfiar dos dois.
    const ofx = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM>
<STMTTRN><DTPOSTED>20260805<TRNAMT>-120.00<FITID>a<MEMO>MERCADO</STMTTRN>
<STMTTRN><DTPOSTED>20260806<TRNAMT>5000.00<FITID>b<MEMO>SALARIO</STMTTRN>
<STMTTRN><DTPOSTED>20260807<TRNAMT>-800.00<FITID>c<MEMO>PAGAMENTO DE FATURA</STMTTRN>
</OFX>`;
    const f = makeFakes({ last4: "1111" });
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: ofx });

    expect(r.totals.entradas).toBe("5000.00");
    expect(r.totals.saidas).toBe("120.00"); // sem os 800 da fatura
    expect(r.totals.neutras).toBe(1);
    expect(r.totals.linhas).toBe(3);
  });

  it("conta quantas precisam de revisão e quantas são da MilWeb", async () => {
    const ofx = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM>
<STMTTRN><DTPOSTED>20260805<TRNAMT>-120.00<FITID>a<MEMO>ANTHROPIC CLAUDE</STMTTRN>
<STMTTRN><DTPOSTED>20260806<TRNAMT>-30.00<FITID>b<MEMO>XPTO 44718899</STMTTRN>
</OFX>`;
    const f = makeFakes({ last4: "1111" });
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: ofx });

    expect(r.totals.milweb).toBe(1);
    expect(r.totals.revisar).toBe(1);
  });
});

describe("análise de CSV", () => {
  const CSV = `Data;Histórico;Valor
05/08/2026;MERCADO BOM PRECO;-1.234,56
15/08/2026;SALARIO;5.000,00`;

  it("detecta separador, decimal, ordem da data e colunas sozinho", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, { fileName: "extrato.csv", content: CSV });

    expect(r.format).toBe("CSV");
    expect(r.detection?.confidence).toBe("alta");
    expect(r.detection?.settings).toMatchObject({
      delimiter: ";",
      decimalSeparator: ",",
      dateOrder: "DMY",
      hasHeader: true,
    });
    expect(r.rows).toHaveLength(2);
  });

  it("CSV não se descreve: identidade vazia e conta perguntada", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, { fileName: "extrato.csv", content: CSV });

    expect(r.identity.kind).toBeNull();
    expect(r.match.level).toBe("nenhuma");
    expect(r.match.reason).toMatch(/não diz se é conta ou cartão/i);
  });

  it("mapeamento corrigido na tela é respeitado sem novo upload", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, {
      fileName: "extrato.csv",
      content: CSV,
      settings: {
        delimiter: ";",
        decimalSeparator: ",",
        dateOrder: "DMY",
        hasHeader: true,
        invertSign: true,
        columnMap: { date: 0, description: 1, amount: 2 },
      },
    });
    // invertSign: o que era saída vira entrada.
    expect(r.rows[0]!.direction).toBe("IN");
  });
});

describe("defeitos encontrados usando o fluxo de verdade", () => {
  const OFX = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM>
<STMTTRN><DTPOSTED>20260805<TRNAMT>-120.00<FITID>d1<MEMO>MERCADO</STMTTRN>
<STMTTRN><DTPOSTED>20260806<TRNAMT>5000.00<FITID>d2<MEMO>SALARIO</STMTTRN>
<STMTTRN><DTPOSTED>20260807<TRNAMT>-800.00<FITID>d3<MEMO>PAGAMENTO DE FATURA</STMTTRN>
<STMTTRN><DTPOSTED>20260808<TRNAMT>-99.90<FITID>d4<MEMO>XPTO 998877</STMTTRN>
</OFX>`;

  it("sem conta escolhida, as linhas NÃO viram todas recusadas", async () => {
    // A deduplicação não roda sem origem, e o status vinha dela: sem conta,
    // nenhuma linha tinha fingerprint e o arquivo inteiro aparecia como
    // recusado, com totais zerados, antes de a pessoa escolher qualquer coisa.
    const f = makeFakes({ last4: "0000" }); // nenhuma conta casa
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: OFX });

    expect(r.match.selectedId).toBeNull();
    expect(r.rows.every((row) => row.status === "NEW")).toBe(true);
    expect(r.totals.invalidas).toBe(0);
  });

  it("e os totais aparecem mesmo antes de escolher a conta", async () => {
    const f = makeFakes({ last4: "0000" });
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: OFX });

    expect(r.totals.entradas).toBe("5000.00");
    expect(r.totals.saidas).toBe("219.90"); // 120 + 99,90; a fatura é neutra
    // Duas: a linha XPTO (não reconhecida) e o SALARIO. As 14 categorias do
    // Cofre são de DESPESA -- não existe "Recebimentos" --, então entrada fica
    // sem categoria de propósito. Empurrar salário para "Outros" seria pior:
    // esconderia num balde a linha que mais importa do mês.
    expect(r.totals.revisar).toBe(2);
  });

  it("linha com erro de leitura continua sendo recusada, com ou sem conta", async () => {
    // A correção não pode ter afrouxado o que É inválido de verdade.
    const semData = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM>
<STMTTRN><TRNAMT>-10.00<FITID>x<MEMO>SEM DATA</STMTTRN></OFX>`;
    const f = makeFakes({ last4: "0000" });
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: semData });

    expect(r.rows[0]!.status).toBe("INVALID");
    expect(r.totals.invalidas).toBe(1);
  });

  it("a data que a análise devolve é aceita pela confirmação", async () => {
    // O ciclo completo da própria API respondia 422: a análise serializa
    // `Date` como ISO e a confirmação exigia só AAAA-MM-DD.
    const f = makeFakes({ last4: "1111" });
    const r = await f.service.analyze(VAULT, { fileName: "e.ofx", content: OFX });
    const novas = r.rows.filter((row) => row.status === "NEW");

    const body = confirmImportSchema.safeParse({
      accountId: "acc-1",
      cardId: null,
      fileName: r.fileName,
      fileHash: r.fileHash,
      format: r.format,
      // Exatamente como a análise devolve, passando por JSON como na rede.
      rows: JSON.parse(JSON.stringify(novas)).map((row: Record<string, unknown>) => ({
        line: row.line,
        date: row.date,
        description: row.description,
        amount: row.amount,
        direction: row.direction,
        externalId: row.externalId,
      })),
      ignored: [],
    });

    expect(body.success).toBe(true);
    if (body.success) {
      // E normaliza para o formato que o resto do sistema usa.
      expect(body.data.rows[0]!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("página web disfarçada de extrato é recusada com mensagem que explica", async () => {
    // Sessão do banco expirada devolve o HTML da tela de login com o nome
    // `extrato.ofx`. Antes, isso virava linhas inválidas e a pessoa conferia
    // uma por uma um problema que era do arquivo inteiro.
    const f = makeFakes();
    await expect(
      f.service.analyze(VAULT, {
        fileName: "extrato.ofx",
        content: "<!DOCTYPE html>\n<html><body>Sua sessão expirou</body></html>",
      }),
    ).rejects.toThrow(/sessão do banco expira/i);
  });

  it("CSV cujas linhas nenhuma pode ser lida é recusado como arquivo, não como linhas", async () => {
    const f = makeFakes();
    await expect(
      f.service.analyze(VAULT, {
        fileName: "coisa.csv",
        content: "aaa;bbb;ccc\nxxx;yyy;zzz\nkkk;jjj;lll",
      }),
    ).rejects.toThrow(/Nenhuma linha deste arquivo/i);
  });

  it("mas mês sem movimentação continua sendo resultado vazio, não erro", async () => {
    // Cabeçalho certo, nenhuma linha de dado: é legítimo.
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, {
      fileName: "vazio.csv",
      content: "Data;Histórico;Valor",
    });
    expect(r.rows).toHaveLength(0);
    expect(r.totals.linhas).toBe(0);
  });
});

describe("desfazer uma importação", () => {
  const OFX = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM>
<STMTTRN><DTPOSTED>20260805<TRNAMT>-120.00<FITID>u1<MEMO>MERCADO</STMTTRN>
<STMTTRN><DTPOSTED>20260806<TRNAMT>-45.00<FITID>u2<MEMO>PADARIA</STMTTRN>
</OFX>`;

  async function importar(f: ReturnType<typeof makeFakes>) {
    const r = await f.service.analyze(VAULT, { fileName: "u.ofx", content: OFX });
    return f.service.confirm(VAULT, {
      accountId: "acc-1",
      cardId: null,
      fileName: r.fileName,
      fileHash: r.fileHash,
      format: r.format,
      rows: r.rows.map((row) => ({
        line: row.line,
        date: row.date!.toISOString().slice(0, 10),
        description: row.description,
        amount: row.amount!,
        direction: row.direction!,
        externalId: row.externalId,
      })),
      ignored: [],
    });
  }

  it("apaga as movimentações e o registro, juntos", async () => {
    // Separados, os dois estados mentem: registro sem movimentações diz "2
    // importadas" com zero no Cofre; movimentações sem registro não sabem de
    // onde vieram.
    const f = makeFakes({ last4: "1111" });
    const lote = await importar(f);
    expect(f.transactions).toHaveLength(2);

    const r = await f.service.undoImport(VAULT, lote.id);

    expect(r.removidas).toBe(2);
    expect(f.transactions).toHaveLength(0);
    expect(f.batches.find((b) => b.id === lote.id)).toBeUndefined();
  });

  it("registro órfão some sem levar nada junto", async () => {
    // O caso que fez esta função existir: o lote diz "2 importadas" e as
    // movimentações já não existem.
    const f = makeFakes({ last4: "1111" });
    const lote = await importar(f);
    f.transactions.length = 0;

    const r = await f.service.undoImport(VAULT, lote.id);
    expect(r.removidas).toBe(0);
    expect(f.batches).toHaveLength(0);
  });

  it("o histórico diz quantas AINDA existem, não quantas entraram", async () => {
    const f = makeFakes({ last4: "1111" });
    await importar(f);

    const antes = await f.service.listBatches(VAULT, 10);
    expect(antes[0]).toMatchObject({ importedRows: 2, linkedTransactions: 2 });

    f.transactions.length = 0;
    const depois = await f.service.listBatches(VAULT, 10);
    // `importedRows` é fato do dia da importação e não muda; o que muda é o
    // número de agora — e é ele que impede a tela de mentir.
    expect(depois[0]).toMatchObject({ importedRows: 2, linkedTransactions: 0 });
  });

  it("recusa quando alguma movimentação baixa uma dívida", async () => {
    // FK Restrict: o banco recusaria e o erro subiria como 500. E desfazer uma
    // importação não pode arrastar consigo o que outro módulo depende.
    const f = makeFakes({
      last4: "1111",
      bloqueadas: [{ description: "PIX BRUNO", motivo: "divida" }],
    });
    const lote = await importar(f);

    await expect(f.service.undoImport(VAULT, lote.id)).rejects.toThrow(/baixa uma dívida/);
    expect(f.transactions).toHaveLength(2);
  });

  it("recusa quando alguma já virou despesa da MilWeb", async () => {
    const f = makeFakes({
      last4: "1111",
      bloqueadas: [{ description: "CLAUDE", motivo: "milweb" }],
    });
    const lote = await importar(f);

    await expect(f.service.undoImport(VAULT, lote.id)).rejects.toThrow(/despesa da MilWeb/);
  });

  it("a mensagem soma os dois motivos quando há os dois", async () => {
    const f = makeFakes({
      last4: "1111",
      bloqueadas: [
        { description: "A", motivo: "divida" },
        { description: "B", motivo: "milweb" },
        { description: "C", motivo: "milweb" },
      ],
    });
    const lote = await importar(f);

    await expect(f.service.undoImport(VAULT, lote.id)).rejects.toThrow(
      /1 baixa uma dívida e 2 já viraram despesas da MilWeb/,
    );
  });

  it("importação que não existe é 404", async () => {
    const f = makeFakes();
    await expect(f.service.undoImport(VAULT, "nao-existe")).rejects.toThrow(/não encontrada/);
  });
});

describe("escolher a origem na tela", () => {
  const CSV = `Data;Histórico;Valor
05/08/2026;MERCADO;-120,50
15/08/2026;SALARIO;5000,00`;

  it("CSV não diz se é conta ou cartão — e é por isso que a escolha importa", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, { fileName: "e.csv", content: CSV });

    expect(r.identity.kind).toBeNull();
    expect(r.match.kind).toBeNull();
    expect(r.match.reason).toMatch(/não diz se é conta ou cartão/i);
  });

  it("escolher uma CONTA define o tipo", async () => {
    // O bug: sobrescrever só `selectedId` deixava `kind` nulo, a tela mandava
    // accountId e cardId os dois nulos, e a confirmação respondia "Informe
    // exatamente uma origem" logo depois de a pessoa ter informado.
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, {
      fileName: "e.csv",
      content: CSV,
      accountId: "acc-1",
    });

    expect(r.match.kind).toBe("account");
    expect(r.match.selectedId).toBe("acc-1");
    expect(r.match.level).toBe("exata");
  });

  it("escolher um CARTÃO define o tipo como cartão", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, {
      fileName: "e.csv",
      content: CSV,
      cardId: "card-1",
    });

    expect(r.match.kind).toBe("card");
    expect(r.match.selectedId).toBe("card-1");
  });

  it("e o texto de apoio para de pedir uma escolha já feita", async () => {
    const f = makeFakes();
    const r = await f.service.analyze(VAULT, {
      fileName: "e.csv",
      content: CSV,
      accountId: "acc-1",
    });

    expect(r.match.reason).not.toMatch(/não diz se é conta ou cartão/i);
    expect(r.match.reason).toMatch(/Você escolheu a conta "Conta"/);
  });

  it("com a origem escolhida, a deduplicação passa a valer", async () => {
    // A chave inclui a conta: sem escolher, ela não existe.
    const f = makeFakes();
    const semConta = await f.service.analyze(VAULT, { fileName: "e.csv", content: CSV });
    const comConta = await f.service.analyze(VAULT, {
      fileName: "e.csv",
      content: CSV,
      accountId: "acc-1",
    });

    expect(semConta.rows.every((r) => r.fingerprint === null)).toBe(true);
    expect(comConta.rows.every((r) => r.fingerprint !== null)).toBe(true);
  });

  it("a escolha ganha até de um casamento automático diferente", async () => {
    // O OFX diz uma conta; a pessoa escolhe outra. Quem manda é ela.
    const f = makeFakes({ last4: "1111" });
    const ofx = `<OFX><BANKACCTFROM><ACCTID>1111</ACCTID></BANKACCTFROM>
<STMTTRN><DTPOSTED>20260805<TRNAMT>-10.00<FITID>x<MEMO>X</STMTTRN></OFX>`;

    const auto = await f.service.analyze(VAULT, { fileName: "e.ofx", content: ofx });
    expect(auto.match.selectedId).toBe("acc-1");

    const manual = await f.service.analyze(VAULT, {
      fileName: "e.ofx",
      content: ofx,
      cardId: "card-1",
    });
    expect(manual.match.kind).toBe("card");
    expect(manual.match.selectedId).toBe("card-1");
  });
});
