import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { PersonalVault } from "../../../domain/entities/personal-vault.js";
import { NotFoundError, VaultLockedError } from "../../../domain/errors/app-error.js";
import type { PersonalVaultRepository } from "../../../domain/repositories/personal-vault-repository.js";
import type { VaultSessionService } from "../../../domain/services/vault-session-service.js";
import {
  VAULT_SESSION_HEADER,
  VAULT_SESSION_RENEW_HEADER,
  createRequireVault,
} from "./require-vault.js";

const OWNER = "user-dono";
const VAULT_ID = "vault-1";

function makeVault(overrides: Partial<PersonalVault> = {}): PersonalVault {
  return {
    id: VAULT_ID,
    ownerUserId: OWNER,
    enabled: true,
    failedAttempts: 0,
    lockedUntil: null,
    lastUnlockedAt: null,
    sessionsInvalidatedAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

function makeVaults(vault: PersonalVault | null): PersonalVaultRepository {
  return {
    findByOwner: vi.fn(async (ownerUserId: string) =>
      vault && vault.ownerUserId === ownerUserId ? vault : null,
    ),
    create: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    setLockedUntil: vi.fn(),
    registerSuccessfulUnlock: vi.fn(),
    invalidateSessions: vi.fn(),
  } as unknown as PersonalVaultRepository;
}

/** Sessão de mentira: o "token" é o JSON das claims, pra o teste focar no
 *  middleware e não no JWT (esse tem teste próprio). */
function makeSessions(configured = true): VaultSessionService {
  return {
    configured,
    sign: vi.fn(() => ({ token: "token-renovado", expiresInSeconds: 900 })),
    verify: vi.fn((token: string) => {
      try {
        return JSON.parse(token) as never;
      } catch {
        return null;
      }
    }),
  } as unknown as VaultSessionService;
}

const claims = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    sub: OWNER,
    vaultId: VAULT_ID,
    scope: "personal-finance",
    iat: Math.floor(new Date("2026-08-27T12:00:00.000Z").getTime() / 1000),
    ...over,
  });

function makeReq(opts: { userId?: string; token?: string } = {}): Request {
  return {
    auth: opts.userId ? { userId: opts.userId } : undefined,
    headers: opts.token ? { [VAULT_SESSION_HEADER]: opts.token } : {},
  } as unknown as Request;
}

function makeRes(): Response & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => (headers[k] = v) } as never;
}

async function run(mw: ReturnType<typeof createRequireVault>, req: Request, res = makeRes()) {
  const next = vi.fn();
  await mw(req, res, next);
  return { next, res, error: next.mock.calls[0]?.[0] as unknown };
}

describe("createRequireVault", () => {
  it("libera o dono com sessão elevada válida e renova a sessão", async () => {
    const mw = createRequireVault(makeVaults(makeVault()), makeSessions());
    const { next, res, error } = await run(mw, makeReq({ userId: OWNER, token: claims() }));

    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    // A renovação é o que faz os 15 minutos serem de inatividade.
    expect(res.headers[VAULT_SESSION_RENEW_HEADER]).toBe("token-renovado");
  });

  it("404 pra quem não tem Cofre -- nem revela que a rota existe", async () => {
    const mw = createRequireVault(makeVaults(null), makeSessions());
    const { error } = await run(mw, makeReq({ userId: "user-sem-cofre", token: claims() }));
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("404 pro Cofre desativado (indistinguível de inexistente)", async () => {
    const mw = createRequireVault(makeVaults(makeVault({ enabled: false })), makeSessions());
    const { error } = await run(mw, makeReq({ userId: OWNER, token: claims() }));
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("404 quando a sessão elevada é de OUTRO usuário", async () => {
    // O atacante entra com a conta dele e apresenta um token de Cofre roubado.
    const vaults = makeVaults(makeVault({ ownerUserId: "user-atacante", id: "vault-do-atacante" }));
    const mw = createRequireVault(vaults, makeSessions());
    const { error } = await run(mw, makeReq({ userId: "user-atacante", token: claims() }));
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("404 quando o token aponta pra outro Cofre do mesmo dono", async () => {
    const mw = createRequireVault(makeVaults(makeVault()), makeSessions());
    const { error } = await run(
      mw,
      makeReq({ userId: OWNER, token: claims({ vaultId: "outro-vault" }) }),
    );
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("sessão NORMAL não substitui a elevada: sem o header, 401 VAULT_LOCKED", async () => {
    const mw = createRequireVault(makeVaults(makeVault()), makeSessions());
    const { error } = await run(mw, makeReq({ userId: OWNER }));
    expect(error).toBeInstanceOf(VaultLockedError);
    expect((error as VaultLockedError).statusCode).toBe(401);
    expect((error as VaultLockedError).code).toBe("VAULT_LOCKED");
  });

  it("401 VAULT_LOCKED com token ilegível (expirado, forjado ou de escopo errado)", async () => {
    const mw = createRequireVault(makeVaults(makeVault()), makeSessions());
    const { error } = await run(mw, makeReq({ userId: OWNER, token: "não-é-um-token" }));
    expect(error).toBeInstanceOf(VaultLockedError);
  });

  it('"Bloquear agora" mata token já emitido -- revogação é server-side', async () => {
    const vault = makeVault({
      // corte depois da emissão do token
      sessionsInvalidatedAt: new Date("2026-08-27T12:00:30.000Z"),
    });
    const mw = createRequireVault(makeVaults(vault), makeSessions());
    const { error } = await run(mw, makeReq({ userId: OWNER, token: claims() }));
    expect(error).toBeInstanceOf(VaultLockedError);
  });

  it("token emitido DEPOIS do corte continua valendo", async () => {
    const vault = makeVault({ sessionsInvalidatedAt: new Date("2026-08-27T11:00:00.000Z") });
    const mw = createRequireVault(makeVaults(vault), makeSessions());
    const { error } = await run(mw, makeReq({ userId: OWNER, token: claims() }));
    expect(error).toBeUndefined();
  });

  it("sem VAULT_SESSION_SECRET o módulo inteiro some (404), não abre sem barreira", async () => {
    const mw = createRequireVault(makeVaults(makeVault()), makeSessions(false));
    const { error } = await run(mw, makeReq({ userId: OWNER, token: claims() }));
    expect(error).toBeInstanceOf(NotFoundError);
  });
});
