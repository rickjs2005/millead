import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { env } from "../../config/env.js";
import { JwtVaultSessionService } from "./jwt-vault-session-service.js";

const service = new JwtVaultSessionService();
const INPUT = { ownerUserId: "user-1", vaultId: "vault-1" };

describe("JwtVaultSessionService", () => {
  it("assina e valida a própria sessão", () => {
    const { token, expiresInSeconds } = service.sign(INPUT);
    const claims = service.verify(token);

    expect(claims).toMatchObject({ sub: "user-1", vaultId: "vault-1", scope: "personal-finance" });
    expect(typeof claims!.iat).toBe("number");
    // TTL padrão de 15 minutos, com folga pro relógio do teste.
    expect(expiresInSeconds).toBeGreaterThan(890);
    expect(expiresInSeconds).toBeLessThanOrEqual(900);
  });

  it("recusa token assinado com OUTRO segredo", () => {
    // É o cenário que justifica o segredo separado: um access token forjado
    // (ou o próprio JWT_ACCESS_SECRET vazado) não pode abrir o Cofre.
    const forjado = jwt.sign(
      { sub: "user-1", vaultId: "vault-1", scope: "personal-finance" },
      env.JWT_ACCESS_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );
    expect(service.verify(forjado)).toBeNull();
  });

  it("recusa token do segredo certo mas de escopo errado", () => {
    const outroEscopo = jwt.sign(
      { sub: "user-1", vaultId: "vault-1", scope: "outra-coisa" },
      env.VAULT_SESSION_SECRET!,
      { algorithm: "HS256", expiresIn: "15m" },
    );
    expect(service.verify(outroEscopo)).toBeNull();
  });

  it("recusa token expirado -- é isso que fecha o Cofre sozinho", () => {
    const expirado = jwt.sign(
      { sub: "user-1", vaultId: "vault-1", scope: "personal-finance" },
      env.VAULT_SESSION_SECRET!,
      { algorithm: "HS256", expiresIn: "-1s" },
    );
    expect(service.verify(expirado)).toBeNull();
  });

  it("recusa `alg: none`", () => {
    const semAssinatura = jwt.sign(
      { sub: "user-1", vaultId: "vault-1", scope: "personal-finance" },
      "",
      { algorithm: "none" },
    );
    expect(service.verify(semAssinatura)).toBeNull();
  });

  it("recusa lixo em vez de explodir", () => {
    expect(service.verify("")).toBeNull();
    expect(service.verify("não.é.jwt")).toBeNull();
  });
});
