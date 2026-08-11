import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthorizedError } from "../../../domain/errors/app-error.js";
import { ownerOrSyncKey } from "./social-routes.js";

function makeReq(headers: Record<string, string | undefined> = {}): Request {
  return { headers } as unknown as Request;
}
const res = {} as Response;

describe("ownerOrSyncKey", () => {
  it("X-Sync-Key valida passa direto (sem chamar authenticate/requireOwner)", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const requireOwner = vi.fn() as unknown as RequestHandler;
    const mw = ownerOrSyncKey("chave-secreta-do-cron", authenticate, requireOwner);
    const next = vi.fn();

    mw(makeReq({ "x-sync-key": "chave-secreta-do-cron" }), res, next);

    expect(next).toHaveBeenCalledWith();
    expect(authenticate).not.toHaveBeenCalled();
    expect(requireOwner).not.toHaveBeenCalled();
  });

  it("X-Sync-Key invalida responde 401 sem fallback pra sessao", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const requireOwner = vi.fn() as unknown as RequestHandler;
    const mw = ownerOrSyncKey("chave-secreta-do-cron", authenticate, requireOwner);
    const next = vi.fn();

    mw(makeReq({ "x-sync-key": "chave-errada" }), res, next);

    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError);
    expect(authenticate).not.toHaveBeenCalled();
    expect(requireOwner).not.toHaveBeenCalled();
  });

  it("sem header X-Sync-Key cai no caminho authenticate + requireOwner", () => {
    const authenticate = vi.fn((_req: Request, _res: Response, cb: NextFunction) =>
      cb(),
    ) as unknown as RequestHandler;
    const requireOwner = vi.fn((_req: Request, _res: Response, cb: NextFunction) =>
      cb(),
    ) as unknown as RequestHandler;
    const mw = ownerOrSyncKey("chave-secreta-do-cron", authenticate, requireOwner);
    const next = vi.fn();

    mw(makeReq({}), res, next);

    expect(authenticate).toHaveBeenCalledTimes(1);
    expect(requireOwner).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("erro do authenticate propaga pro next sem chamar requireOwner", () => {
    const authError = new Error("token invalido");
    const authenticate = vi.fn((_req: Request, _res: Response, cb: NextFunction) =>
      cb(authError),
    ) as unknown as RequestHandler;
    const requireOwner = vi.fn() as unknown as RequestHandler;
    const mw = ownerOrSyncKey("chave-secreta-do-cron", authenticate, requireOwner);
    const next = vi.fn();

    mw(makeReq({}), res, next);

    expect(next).toHaveBeenCalledWith(authError);
    expect(requireOwner).not.toHaveBeenCalled();
  });

  it("MILSOCIAL_SYNC_KEY nao configurada + header presente responde 401", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const requireOwner = vi.fn() as unknown as RequestHandler;
    const mw = ownerOrSyncKey(undefined, authenticate, requireOwner);
    const next = vi.fn();

    mw(makeReq({ "x-sync-key": "qualquer-coisa" }), res, next);

    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError);
    expect(authenticate).not.toHaveBeenCalled();
    expect(requireOwner).not.toHaveBeenCalled();
  });
});
