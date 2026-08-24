import { describe, expect, it, vi } from "vitest";
import type { Request, RequestHandler, Response } from "express";
import { apiKeyOrSession } from "./api-key-or-session.js";

const PERMISSIONS = ["project-checklists:read", "project-checklists:write"] as const;
const KEY = "chave-secreta-com-24-ou-mais-chars";

function fakeReqRes(headers: Record<string, string> = {}) {
  const req = { headers, auth: undefined } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe("apiKeyOrSession", () => {
  it("popula req.auth quando o header bate com a chave configurada", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(KEY, "org-1", PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({ "x-automation-key": KEY });

    middleware(req, res, next);

    expect(req.auth).toMatchObject({ organizationId: "org-1", permissions: [...PERMISSIONS] });
    expect(next).toHaveBeenCalledWith();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("chama next com erro quando o header vem errado, sem cair pra sessão", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(KEY, "org-1", PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({ "x-automation-key": "chave-errada" });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("cai pro fluxo de sessão normal quando o header está ausente", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(KEY, "org-1", PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({});

    middleware(req, res, next);

    expect(authenticate).toHaveBeenCalledWith(req, res, next);
  });

  it("rejeita mesmo com header certo se a key/organizationId não estiverem configurados", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(undefined, undefined, PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({ "x-automation-key": KEY });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
