import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import { createRequireOwner } from "./require-owner.js";

function makeReq(auth?: { userId: string }): Request {
  return { auth } as unknown as Request;
}
const res = {} as Response;

function makeUserRepo(email: string | null) {
  return {
    findById: vi.fn(async () =>
      email ? { id: "u1", email, name: "X", isActive: true } : null,
    ),
  };
}

describe("createRequireOwner", () => {
  it("deixa o dono passar (comparacao case-insensitive)", async () => {
    const mw = createRequireOwner(makeUserRepo("Rick@MilWeb.com.br") as never, "rick@milweb.com.br");
    const next = vi.fn();
    await mw(makeReq({ userId: "u1" }), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("responde 404 pra nao-dono (nao revela a rota)", async () => {
    const mw = createRequireOwner(makeUserRepo("outro@x.com") as never, "rick@milweb.com.br");
    const next = vi.fn();
    await mw(makeReq({ userId: "u1" }), res, next);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(NotFoundError);
  });

  it("responde 404 quando OWNER_EMAIL nao esta configurado", async () => {
    const mw = createRequireOwner(makeUserRepo("rick@milweb.com.br") as never, undefined);
    const next = vi.fn();
    await mw(makeReq({ userId: "u1" }), res, next);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(NotFoundError);
  });

  it("responde 401 sem req.auth", async () => {
    const mw = createRequireOwner(makeUserRepo("rick@milweb.com.br") as never, "rick@milweb.com.br");
    const next = vi.fn();
    await mw(makeReq(undefined), res, next);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError);
  });
});
