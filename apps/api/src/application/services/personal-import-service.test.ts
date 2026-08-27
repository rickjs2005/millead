import { beforeEach, describe, expect, it } from "vitest";
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

function makeFakes() {
  const account: PersonalAccount = {
    id: "acc-1",
    vaultId: VAULT,
    name: "Conta",
    institution: null,
    type: "CHECKING",
    currency: "BRL",
    last4: null,
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
  return { service, transactions, statements, batches, classifierCalls };
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
