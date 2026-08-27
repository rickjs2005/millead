import { describe, expect, it } from "vitest";
import type { BackupRow, VaultDump } from "../../domain/repositories/personal-backup-repository.js";
import {
  EXPORT_VERSION,
  backupFileName,
  buildBackup,
  buildCsvNames,
  rejectBackup,
  toCsv,
} from "./vault-export.js";
import { utcDate } from "./vault-date.js";

function dumpVazio(): VaultDump {
  return {
    categories: [],
    accounts: [],
    cards: [],
    merchants: [],
    statements: [],
    importBatches: [],
    subscriptions: [],
    transactions: [],
    rules: [],
    alerts: [],
    contacts: [],
    debts: [],
    businessSends: [],
  };
}

function movimentacao(over: Record<string, unknown> = {}) {
  return {
    id: "tx-1",
    transactionDate: utcDate(2026, 8, 5),
    settlementDate: null,
    originalDescription: "ANTHROPIC CLAUDE",
    direction: "OUT",
    amount: "300.00",
    amountBrl: "300.00",
    currency: "BRL",
    categoryId: "cat-1",
    merchantId: "mer-1",
    accountId: "acc-1",
    cardId: null,
    status: "CONFIRMED",
    isTransfer: false,
    note: null,
    splits: [] as BackupRow[],
    ...over,
  } as unknown as VaultDump["transactions"][number];
}

describe("envelope do backup", () => {
  it("carrega formato, versão e contagens no topo", () => {
    const dump = dumpVazio();
    dump.transactions = [
      movimentacao({ splits: [{ id: "s1", kind: "BUSINESS", amount: "100.00" }] }),
    ];
    dump.debts = [
      { id: "d1", payments: [{ id: "p1" }, { id: "p2" }] } as unknown as VaultDump["debts"][number],
    ];

    const backup = buildBackup(dump, new Date("2026-08-28T12:00:00.000Z"));

    expect(backup.formato).toBe("millead-cofre");
    expect(backup.versao).toBe(EXPORT_VERSION);
    expect(backup.geradoEm).toBe("2026-08-28T12:00:00.000Z");
    // As contagens existem pra conferir de bater o olho se o arquivo veio
    // inteiro, antes de confiar nele.
    expect(backup.resumo.movimentacoes).toBe(1);
    expect(backup.resumo.rateios).toBe(1);
    expect(backup.resumo.baixas).toBe(2);
  });

  it("não perde colunas que os tipos daqui nem conhecem", () => {
    // Esta é a propriedade que o `omit` do dump existe pra garantir: uma coluna
    // acrescentada ao schema amanhã tem de viajar sozinha. Se algum ponto do
    // caminho filtrasse por lista de campos, o backup sairia incompleto em
    // silêncio -- e só se descobre no dia de restaurar.
    const dump = dumpVazio();
    dump.accounts = [{ id: "acc-1", colunaInventadaNoFuturo: "importa" } as BackupRow];

    const backup = buildBackup(dump, new Date());

    expect(backup.conteudo.accounts[0]).toHaveProperty("colunaInventadaNoFuturo", "importa");
  });
});

describe("recusa de arquivo", () => {
  it("aceita um backup da versão corrente", () => {
    const backup = buildBackup(dumpVazio(), new Date());
    expect(rejectBackup(backup)).toBeNull();
  });

  it("recusa arquivo que não é do Cofre", () => {
    expect(rejectBackup({ qualquer: "coisa" })).toMatch(/não é um backup/);
    expect(rejectBackup("texto")).toMatch(/não é um backup/);
    expect(rejectBackup(null)).toMatch(/não é um backup/);
  });

  it("recusa versão futura em vez de adivinhar", () => {
    // Ler pela metade é pior que recusar: o segundo você resolve, o primeiro
    // você descobre meses depois com metade da história faltando.
    const backup = { ...buildBackup(dumpVazio(), new Date()), versao: 2 };
    expect(rejectBackup(backup)).toMatch(/versão 2/);
  });

  it("recusa backup sem conteúdo", () => {
    const backup = { formato: "millead-cofre", versao: EXPORT_VERSION };
    expect(rejectBackup(backup)).toMatch(/sem conteúdo/);
  });
});

describe("planilha", () => {
  function csvDe(dump: VaultDump) {
    return toCsv(dump, buildCsvNames(dump));
  }

  it("resolve nomes em vez de despejar ids", () => {
    const dump = dumpVazio();
    dump.categories = [
      { id: "cat-raiz", parentId: null, name: "Trabalho" } as BackupRow,
      { id: "cat-1", parentId: "cat-raiz", name: "IA" } as BackupRow,
    ];
    dump.merchants = [
      { id: "mer-1", name: "Anthropic", aliases: [] } as unknown as VaultDump["merchants"][number],
    ];
    dump.accounts = [{ id: "acc-1", name: "Nubank" } as BackupRow];
    dump.transactions = [movimentacao()];

    const csv = csvDe(dump);

    expect(csv).toContain("Trabalho / IA");
    expect(csv).toContain("Anthropic");
    expect(csv).toContain("Nubank");
    expect(csv).not.toContain("cat-1");
  });

  it("neutraliza fórmula na descrição — o texto vem do banco, não de você", () => {
    // Descrição de extrato é o nome que o estabelecimento cadastrou: texto de
    // terceiro. `=HYPERLINK(...)` viraria um link ativo na planilha de quem
    // abrisse o arquivo.
    const dump = dumpVazio();
    dump.transactions = [
      movimentacao({ originalDescription: '=HYPERLINK("http://exemplo","clique")' }),
      movimentacao({ id: "tx-2", originalDescription: "+SOMA(A1:A9)" }),
      movimentacao({ id: "tx-3", originalDescription: "@importar" }),
    ];

    const csv = csvDe(dump);

    expect(csv).not.toMatch(/(^|;|")=HYPERLINK/);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+SOMA");
    expect(csv).toContain("'@importar");
  });

  it("escapa separador e aspas dentro do campo", () => {
    const dump = dumpVazio();
    dump.transactions = [movimentacao({ originalDescription: 'MERCADO; "BOM PRECO"' })];

    const csv = csvDe(dump);
    const linha = csv.split("\r\n")[1]!;

    // Sem o escape, o ponto e vírgula quebraria a linha em duas colunas e
    // todas as seguintes sairiam deslocadas -- silenciosamente.
    expect(linha).toContain('"MERCADO; ""BOM PRECO"""');
    expect(linha.split(";").length).toBe(18); // 17 colunas + o ; de dentro do campo
  });

  it("decimal com vírgula e data em dd/mm/aaaa", () => {
    const dump = dumpVazio();
    dump.transactions = [movimentacao()];

    const csv = csvDe(dump);

    expect(csv).toContain("05/08/2026");
    expect(csv).toContain("300,00");
    expect(csv).not.toContain("300.00");
  });

  it("a data não desliza um dia", () => {
    // As colunas são `@db.Date` à meia-noite UTC. Formatar no fuso local
    // mostraria 04/08 no Brasil.
    const dump = dumpVazio();
    dump.transactions = [movimentacao({ transactionDate: utcDate(2026, 8, 1) })];
    expect(csvDe(dump)).toContain("01/08/2026");
  });

  it("começa com BOM, senão o Excel come os acentos", () => {
    expect(csvDe(dumpVazio()).charCodeAt(0)).toBe(0xfeff);
  });

  it("deriva as colunas de rateio", () => {
    const dump = dumpVazio();
    dump.transactions = [
      movimentacao({
        splits: [
          { id: "s1", kind: "BUSINESS", amount: "100.00" },
          { id: "s2", kind: "REIMBURSABLE", amount: "50.00" },
        ],
      }),
    ];

    const linha = csvDe(dump).split("\r\n")[1]!;
    const colunas = linha.split(";");

    expect(colunas[13]).toBe("100,00"); // parte da empresa
    expect(colunas[14]).toBe("50,00"); // reembolsável
    expect(colunas[15]).toBe("150,00"); // consumo pessoal: 300 - 100 - 50
  });
});

describe("nome do arquivo", () => {
  it("não anuncia o que tem dentro", () => {
    // O nome é a única parte que aparece sem abrir -- na pasta de downloads,
    // no backup de nuvem, num anexo.
    const nome = backupFileName(new Date("2026-08-28T12:00:00.000Z"), "json");
    expect(nome).toBe("millead-2026-08-28.json");
    expect(nome).not.toMatch(/cofre|financeiro|pessoal|extrato/i);
  });
});
