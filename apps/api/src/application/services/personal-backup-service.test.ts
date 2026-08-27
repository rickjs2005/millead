import { describe, expect, it, vi } from "vitest";
import type {
  PersonalBackupRepository,
  RestoreCounts,
  VaultDump,
} from "../../domain/repositories/personal-backup-repository.js";
import type { VaultReauthenticator } from "../../domain/services/vault-reauthenticator.js";
import { UnauthorizedError } from "../../domain/errors/app-error.js";
import type { AuditLogger } from "./audit-logger.js";
import { PersonalBackupService, reviveDates } from "./personal-backup-service.js";
import { buildBackup } from "./vault-export.js";
import { utcDate } from "./vault-date.js";

const VAULT = "vault-1";
const CTX = { userId: "u1", ipAddress: "127.0.0.1", userAgent: "teste" };
const SENHA = "senha-certa";

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

function makeFakes(options: { vazio?: boolean; dump?: VaultDump } = {}) {
  const dump = options.dump ?? dumpVazio();
  const restaurado: VaultDump[] = [];
  const eventos: Array<{ acao: string; metadata: unknown }> = [];

  const repo: PersonalBackupRepository = {
    dump: async () => dump,
    isEmpty: async () => options.vazio ?? true,
    restore: async (_v, recebido) => {
      restaurado.push(recebido);
      return {
        categorias: recebido.categories.length,
        contas: recebido.accounts.length,
        cartoes: 0,
        fornecedores: 0,
        faturas: 0,
        importacoes: 0,
        assinaturas: 0,
        movimentacoes: recebido.transactions.length,
        rateios: 0,
        regras: 0,
        alertas: 0,
        pessoas: 0,
        dividas: 0,
        baixas: 0,
        enviosIgnorados: recebido.businessSends.length,
      } satisfies RestoreCounts;
    },
  };

  const confirmPassword = vi.fn(async (_ctx, senha: string, acao: string) => {
    if (senha !== SENHA) throw new UnauthorizedError("Senha incorreta.");
    eventos.push({ acao, metadata: null });
    return VAULT;
  });
  const reauth = { confirmPassword } as unknown as VaultReauthenticator;

  const audit = {
    log: vi.fn(async (_ctx, acao: string, dados: { metadata?: unknown }) => {
      eventos.push({ acao, metadata: dados.metadata });
    }),
  } as unknown as AuditLogger;

  return {
    service: new PersonalBackupService(repo, reauth, audit),
    restaurado,
    eventos,
    confirmPassword,
  };
}

describe("exportação", () => {
  it("exige a senha de novo, mesmo com o Cofre aberto", async () => {
    // A sessão elevada dá leitura tela a tela; a exportação entrega tudo num
    // arquivo. Pedir a senha fecha a janela do "notebook destravado".
    const f = makeFakes();
    await expect(f.service.export(CTX, "senha-errada", "json")).rejects.toThrow(UnauthorizedError);
  });

  it("a confirmação usa a ação certa na trilha", async () => {
    const f = makeFakes();
    await f.service.export(CTX, SENHA, "json");
    expect(f.confirmPassword).toHaveBeenCalledWith(CTX, SENHA, "vault.export");
  });

  it("audita a exportação com contagens — e nenhum dado", async () => {
    const dump = dumpVazio();
    dump.accounts = [{ id: "acc-1", name: "Nubank", last4: "1234" }];
    dump.transactions = [
      {
        id: "tx-1",
        originalDescription: "ANTHROPIC CLAUDE",
        amountBrl: "300.00",
        transactionDate: utcDate(2026, 8, 5),
        splits: [],
      } as never,
    ];
    const f = makeFakes({ dump });

    await f.service.export(CTX, SENHA, "json");

    const registro = f.eventos.find((e) => e.acao === "vault.exported");
    const serializado = JSON.stringify(registro?.metadata);
    expect(registro).toBeDefined();
    expect(serializado).toContain('"movimentacoes":1');
    // Se a trilha carregasse o conteúdo, ela mesma viraria uma segunda cópia
    // do Cofre -- numa tabela sem sessão elevada na frente.
    expect(serializado).not.toContain("ANTHROPIC");
    expect(serializado).not.toContain("Nubank");
    expect(serializado).not.toContain("300.00");
  });

  it("JSON sai com o envelope completo e nome que não denuncia nada", async () => {
    const f = makeFakes();
    const r = await f.service.export(CTX, SENHA, "json", new Date("2026-08-28T10:00:00.000Z"));

    expect(r.fileName).toBe("millead-2026-08-28.json");
    expect(r.contentType).toContain("application/json");
    expect(JSON.parse(r.body).formato).toBe("millead-cofre");
  });

  it("CSV sai como planilha, não como backup", async () => {
    const f = makeFakes();
    const r = await f.service.export(CTX, SENHA, "csv", new Date("2026-08-28T10:00:00.000Z"));

    expect(r.fileName).toBe("millead-2026-08-28.csv");
    expect(r.contentType).toContain("text/csv");
    expect(r.body).toContain("Descrição");
  });
});

describe("restauração", () => {
  function arquivoValido(dump = dumpVazio()) {
    return JSON.parse(JSON.stringify(buildBackup(dump, new Date("2026-08-01T00:00:00.000Z"))));
  }

  it("exige a senha", async () => {
    const f = makeFakes();
    await expect(f.service.restore(CTX, "errada", arquivoValido())).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("recusa entrar num Cofre que já tem dados", async () => {
    // Mesclar duplicaria dinheiro em silêncio; sobrescrever destruiria o que
    // está lá. Recusar é a única resposta que não perde nem inventa dado.
    const f = makeFakes({ vazio: false });
    await expect(f.service.restore(CTX, SENHA, arquivoValido())).rejects.toThrow(
      /só entra num Cofre vazio/,
    );
    expect(f.restaurado).toHaveLength(0);
  });

  it("recusa arquivo errado ANTES de olhar se o Cofre está cheio", async () => {
    // Quem mandou o arquivo errado precisa saber que é o arquivo errado.
    const f = makeFakes({ vazio: false });
    await expect(f.service.restore(CTX, SENHA, { qualquer: "coisa" })).rejects.toThrow(
      /não é um backup/,
    );
  });

  it("recusa versão que não sabe ler", async () => {
    const f = makeFakes();
    await expect(f.service.restore(CTX, SENHA, { ...arquivoValido(), versao: 99 })).rejects.toThrow(
      /versão 99/,
    );
  });

  it("devolve as datas ao tipo certo — JSON não tem Date", async () => {
    const dump = dumpVazio();
    dump.transactions = [{ id: "tx-1", transactionDate: utcDate(2026, 8, 5), splits: [] } as never];
    const f = makeFakes({ dump: dumpVazio() });

    // Passa pelo JSON de verdade: é assim que o arquivo chega.
    await f.service.restore(CTX, SENHA, arquivoValido(dump));

    const recebida = f.restaurado[0]!.transactions[0]!;
    expect(recebida.transactionDate).toBeInstanceOf(Date);
    expect((recebida.transactionDate as Date).toISOString()).toBe("2026-08-05T00:00:00.000Z");
  });

  it("não recria os envios ao financeiro, e diz quantos ficaram de fora", async () => {
    // A despesa do outro lado é dado da MilWeb e não está no arquivo; recriar
    // metade do vínculo apontaria pra uma despesa que não existe.
    const dump = dumpVazio();
    dump.businessSends = [{ id: "tx-1", transactionId: "tx-1", amount: "100.00" }];
    const f = makeFakes();

    const contagens = await f.service.restore(CTX, SENHA, arquivoValido(dump));
    expect(contagens.enviosIgnorados).toBe(1);
  });

  it("audita a restauração com contagens", async () => {
    const f = makeFakes();
    await f.service.restore(CTX, SENHA, arquivoValido());
    expect(f.eventos.some((e) => e.acao === "vault.restored")).toBe(true);
  });
});

describe("reviveDates", () => {
  it("converte só o que tem cara de instante ISO", () => {
    const entrada = {
      data: "2026-08-05T00:00:00.000Z",
      texto: "2026-08-05",
      descricao: "PAGAMENTO 2026",
      numero: 5,
      nulo: null,
      lista: ["2026-01-01T12:00:00.000Z", "nada"],
    };

    const saida = reviveDates(entrada);

    expect(saida.data).toBeInstanceOf(Date);
    // "2026-08-05" sozinho é texto legítimo em campos como `fileName`; só o
    // formato completo vira data.
    expect(saida.texto).toBe("2026-08-05");
    expect(saida.descricao).toBe("PAGAMENTO 2026");
    expect(saida.numero).toBe(5);
    expect(saida.nulo).toBeNull();
    expect(saida.lista[0]).toBeInstanceOf(Date);
    expect(saida.lista[1]).toBe("nada");
  });
});
