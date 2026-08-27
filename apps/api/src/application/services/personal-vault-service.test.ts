import { describe, expect, it, vi } from "vitest";
import type { PersonalVault } from "../../domain/entities/personal-vault.js";
import { NotFoundError, UnauthorizedError } from "../../domain/errors/app-error.js";
import { PersonalVaultService } from "./personal-vault-service.js";
import { MAX_ATTEMPTS_BEFORE_LOCK } from "./vault-lockout.js";

const OWNER = "user-dono";
const CTX = { organizationId: "org-milweb", userId: OWNER, ipAddress: null, userAgent: null };

function makeVault(over: Partial<PersonalVault> = {}): PersonalVault {
  return {
    id: "vault-1",
    ownerUserId: OWNER,
    enabled: true,
    failedAttempts: 0,
    lockedUntil: null,
    lastUnlockedAt: null,
    sessionsInvalidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function setup(
  opts: {
    vault?: PersonalVault | null;
    passwordOk?: boolean;
    attempts?: number;
    lockedUntil?: Date | null;
  } = {},
) {
  const vault =
    opts.vault === undefined
      ? makeVault(opts.lockedUntil ? { lockedUntil: opts.lockedUntil } : {})
      : opts.vault;
  const vaults = {
    findByOwner: vi.fn(async () => vault),
    create: vi.fn<(ownerUserId: string) => Promise<PersonalVault | null>>(async () => makeVault()),
    incrementFailedAttempts: vi.fn(async () => opts.attempts ?? 1),
    setLockedUntil: vi.fn(async () => undefined),
    registerSuccessfulUnlock: vi.fn(async () => undefined),
    invalidateSessions: vi.fn(async () => undefined),
  };
  const users = {
    findById: vi.fn(async () => ({ id: OWNER, passwordHash: "hash", email: "x", name: "X" })),
  };
  const hasher = {
    hash: vi.fn(),
    compare: vi.fn(async () => opts.passwordOk ?? true),
  };
  const sessions = {
    configured: true,
    sign: vi.fn(() => ({ token: "tok", expiresInSeconds: 900 })),
    verify: vi.fn(),
  };
  // Tipado explicitamente pra o tsc enxergar os argumentos em `mock.calls` --
  // é neles que os testes de privacidade da auditoria olham.
  const provisioner = { seedDefaults: vi.fn(async () => undefined) };
  const audit = {
    log: vi.fn<
      (
        context: { organizationId: string | null; userId: string | null },
        action: string,
        details?: { metadata?: Record<string, unknown> },
      ) => Promise<void>
    >(async () => undefined),
  };

  const service = new PersonalVaultService(
    vaults as never,
    users as never,
    hasher as never,
    sessions as never,
    audit as never,
    provisioner as never,
  );
  return { service, vaults, users, hasher, sessions, audit, provisioner };
}

describe("PersonalVaultService — posse", () => {
  it("404 em status/unlock/lock pra quem não tem Cofre", async () => {
    const { service } = setup({ vault: null });
    await expect(service.status(OWNER)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.unlock(OWNER, "senha", CTX)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.lock(OWNER, CTX)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("Cofre desativado responde igual a inexistente", async () => {
    const { service } = setup({ vault: makeVault({ enabled: false }) });
    await expect(service.status(OWNER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("criar é idempotente -- segunda chamada não é erro nem cria outro", async () => {
    const { service, vaults } = setup();
    vaults.create.mockResolvedValueOnce(null);
    await expect(service.create(OWNER, CTX)).resolves.toEqual({ created: false });
  });

  it("criar provisiona as categorias padrão", async () => {
    const { service, provisioner } = setup();
    await service.create(OWNER, CTX);
    expect(provisioner.seedDefaults).toHaveBeenCalledWith("vault-1");
  });

  it("provisiona de novo mesmo se o Cofre já existia -- auto-corretivo", async () => {
    // Se o provisionamento falhou numa tentativa anterior, o Cofre ficaria sem
    // categoria nenhuma e sem caminho de volta. Semear sempre conserta.
    const { service, vaults, provisioner } = setup();
    vaults.create.mockResolvedValueOnce(null);
    await service.create(OWNER, CTX);
    expect(provisioner.seedDefaults).toHaveBeenCalledWith("vault-1");
  });
});

describe("PersonalVaultService — desbloqueio", () => {
  it("senha certa emite sessão elevada e zera o contador", async () => {
    const { service, vaults, sessions } = setup({ passwordOk: true });
    const result = await service.unlock(OWNER, "senha-certa", CTX);

    expect(result.token).toBe("tok");
    expect(vaults.registerSuccessfulUnlock).toHaveBeenCalledWith(OWNER, expect.any(Date));
    expect(sessions.sign).toHaveBeenCalledWith({ ownerUserId: OWNER, vaultId: "vault-1" });
  });

  it("senha errada conta a tentativa e recusa", async () => {
    const { service, vaults } = setup({ passwordOk: false, attempts: 1 });
    await expect(service.unlock(OWNER, "errada", CTX)).rejects.toBeInstanceOf(UnauthorizedError);

    expect(vaults.incrementFailedAttempts).toHaveBeenCalledWith(OWNER);
    // Ainda dentro do orçamento: nada de bloqueio.
    expect(vaults.setLockedUntil).not.toHaveBeenCalled();
  });

  it("bloqueia ao esgotar as tentativas", async () => {
    const { service, vaults } = setup({ passwordOk: false, attempts: MAX_ATTEMPTS_BEFORE_LOCK });
    await expect(service.unlock(OWNER, "errada", CTX)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(vaults.setLockedUntil).toHaveBeenCalledWith(OWNER, expect.any(Date));
  });

  it("com o Cofre bloqueado nem chega a testar a senha", async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    const { service, hasher } = setup({ vault: makeVault({ lockedUntil }) });
    await expect(service.unlock(OWNER, "qualquer", CTX)).rejects.toBeInstanceOf(UnauthorizedError);
    // Não gastar bcrypt durante o bloqueio é o que impede o lockout de virar
    // um amplificador de CPU pra quem continua martelando a rota.
    expect(hasher.compare).not.toHaveBeenCalled();
  });

  it("bloqueio vencido volta a aceitar tentativa", async () => {
    const lockedUntil = new Date(Date.now() - 1_000);
    const { service, hasher } = setup({ vault: makeVault({ lockedUntil }), passwordOk: true });
    await expect(service.unlock(OWNER, "certa", CTX)).resolves.toMatchObject({ token: "tok" });
    expect(hasher.compare).toHaveBeenCalled();
  });
});

describe("PersonalVaultService — auditoria", () => {
  it("nunca carimba a organização e nunca grava dado financeiro", async () => {
    const { service, audit } = setup({ passwordOk: true });
    await service.unlock(OWNER, "certa", CTX);
    await service.lock(OWNER, CTX);

    expect(audit.log).toHaveBeenCalled();
    for (const [context, action, details] of audit.log.mock.calls) {
      // A trilha do Cofre não pertence à empresa.
      expect(context.organizationId).toBeNull();
      expect(action).toMatch(/^vault\./);
      const metadata = JSON.stringify(details?.metadata ?? {});
      // Nada de valor, saldo, descrição bancária ou senha na trilha.
      expect(metadata).not.toMatch(/certa|senha|amount|saldo|valor/i);
    }
  });

  it("registra a tentativa inválida sem revelar a senha tentada", async () => {
    const { service, audit } = setup({ passwordOk: false, attempts: 2 });
    await expect(service.unlock(OWNER, "senha-secreta-tentada", CTX)).rejects.toThrow();

    const call = audit.log.mock.calls.find(([, action]) => action === "vault.unlock_failed");
    expect(call).toBeDefined();
    expect(JSON.stringify(call)).not.toContain("senha-secreta-tentada");
    expect(call![2]?.metadata).toEqual({ failedAttempts: 2, locked: false });
  });
});

describe("confirmação de senha (porta VaultReauthenticator)", () => {
  const REAUTH = { userId: OWNER, ipAddress: "127.0.0.1", userAgent: "teste" };

  it("devolve o vaultId quando a senha confere", async () => {
    const { service } = setup({ passwordOk: true });
    await expect(service.confirmPassword(REAUTH, "certa", "vault.export")).resolves.toBeTruthy();
  });

  it("usa o MESMO balde de tentativas do desbloqueio", async () => {
    // Sem isto, a exportação viraria um oráculo de senha: dá pra testar
    // candidatas ali em volume sem nunca disparar o bloqueio da tela de
    // desbloqueio.
    const { service, vaults } = setup({ passwordOk: false, attempts: 3 });

    await expect(service.confirmPassword(REAUTH, "errada", "vault.export")).rejects.toThrow(
      /Senha incorreta/,
    );
    expect(vaults.incrementFailedAttempts).toHaveBeenCalledWith(OWNER);
  });

  it("respeita o castigo em andamento", async () => {
    const { service } = setup({ passwordOk: true, lockedUntil: new Date(Date.now() + 60_000) });
    await expect(service.confirmPassword(REAUTH, "certa", "vault.export")).rejects.toThrow(
      /temporariamente bloqueado/,
    );
  });

  it("NÃO emite sessão nova — confirmar pra exportar não estende o Cofre aberto", async () => {
    const { service, sessions } = setup({ passwordOk: true });
    await service.confirmPassword(REAUTH, "certa", "vault.export");
    expect(sessions.sign).not.toHaveBeenCalled();
  });

  it("a ação entra na trilha, pra dizer o que foi confirmado", async () => {
    const { service, audit } = setup({ passwordOk: false, attempts: 1 });
    await expect(service.confirmPassword(REAUTH, "errada", "vault.export")).rejects.toThrow();

    const acoes = audit.log.mock.calls.map(([, action]) => action);
    expect(acoes).toContain("vault.export_failed");
  });
});
