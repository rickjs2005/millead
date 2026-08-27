import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { PERMISSIONS } from "@millead/database/permissions";
import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { VaultLockedError } from "../../../domain/errors/app-error.js";
import type { PersonalBridgeController } from "../controllers/personal-bridge-controller.js";
import { errorHandler } from "../middlewares/error-handler.js";
import { createVaultBridgeRoutes } from "./vault-bridge-routes.js";

/**
 * A ponte é o **único pedaço do Cofre com RBAC**, e é isso que este arquivo
 * prova.
 *
 * O risco concreto: se estas rotas não checassem permissão, alguém sem acesso
 * nenhum ao financeiro poderia lançar custo na MilWeb passando pelo Cofre — a
 * ponte viraria um atalho para contornar a permissão do módulo de custos. O
 * Cofre não ter RBAC nos SEUS dados não estende esse privilégio ao dado da
 * organização.
 *
 * As três camadas se somam, e cada teste abaixo tira uma:
 * `authenticate` (quem é) · `requireVault` (o Cofre é seu e está aberto) ·
 * `requirePermission` (você pode mexer no financeiro desta organização).
 */
const ROTAS: ReadonlyArray<{
  method: "get" | "post" | "delete";
  path: string;
  permissao: string;
}> = [
  { method: "get", path: "/business/allocations", permissao: PERMISSIONS.PROPOSALS_READ },
  { method: "get", path: "/business/plans", permissao: PERMISSIONS.PROPOSALS_READ },
  { method: "get", path: "/business/allocations/abc", permissao: PERMISSIONS.PROPOSALS_READ },
  { method: "post", path: "/business/allocations/abc", permissao: PERMISSIONS.PROPOSALS_WRITE },
  {
    method: "post",
    path: "/business/allocations/abc/sync",
    permissao: PERMISSIONS.PROPOSALS_WRITE,
  },
  { method: "delete", path: "/business/allocations/abc", permissao: PERMISSIONS.PROPOSALS_WRITE },
];

/** Corpo válido pro POST de envio — com corpo inválido a validação responderia
 *  422 antes do controller, e o teste passaria mesmo sem RBAC nenhum. */
const CORPO_VALIDO = { description: "Claude Pro — MilWeb", category: "AI" };

function fakeAuthenticate(permissions: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.auth = {
      userId: "u1",
      organizationId: "org-1",
      permissions,
    } as unknown as Request["auth"];
    next();
  };
}

const vaultLocked: RequestHandler = (_req, _res, next) => {
  next(new VaultLockedError("Cofre bloqueado. Reautentique para abrir."));
};

const vaultOpen: RequestHandler = (req, _res, next) => {
  req.vault = { vaultId: "vault-1", ownerUserId: "u1" };
  next();
};

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function listen(app: express.Express): Promise<string> {
  const server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

function stubController() {
  const called: string[] = [];
  const handler = (name: string) => async (_req: Request, res: Response) => {
    called.push(name);
    res.status(200).json({ ok: true });
  };
  const controller = Object.fromEntries(
    ["list", "listPlans", "status", "push", "sync", "revert"].map((n) => [n, handler(n)]),
  ) as unknown as PersonalBridgeController;
  return { controller, called };
}

function buildApp(vault: RequestHandler, permissions: string[]) {
  const { controller, called } = stubController();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/vault",
    createVaultBridgeRoutes(controller, fakeAuthenticate(permissions), vault),
  );
  app.use(errorHandler);
  return { app, called };
}

const TUDO = [PERMISSIONS.PROPOSALS_READ, PERMISSIONS.PROPOSALS_WRITE];

async function chamar(base: string, rota: (typeof ROTAS)[number]) {
  return fetch(`${base}/api/v1/vault${rota.path}`, {
    method: rota.method,
    headers: { "content-type": "application/json" },
    body: rota.method === "post" ? JSON.stringify(CORPO_VALIDO) : undefined,
  });
}

describe("ponte com o financeiro — sessão elevada", () => {
  it.each(ROTAS)("$method $path exige o Cofre aberto", async (rota) => {
    const { app, called } = buildApp(vaultLocked, TUDO);
    const base = await listen(app);

    const res = await chamar(base, rota);

    expect(res.status).toBe(401);
    // Ter permissão no financeiro não abre o Cofre: o controller nem é
    // alcançado.
    expect(called).toEqual([]);
  });
});

describe("ponte com o financeiro — RBAC", () => {
  it.each(ROTAS)("$method $path exige $permissao", async (rota) => {
    const { app, called } = buildApp(vaultOpen, []);
    const base = await listen(app);

    const res = await chamar(base, rota);

    // Sem esta barreira, a ponte seria um caminho pra lançar custo na MilWeb
    // sem nenhuma permissão no financeiro.
    expect(res.status).toBe(403);
    expect(called).toEqual([]);
  });

  it("quem só lê não consegue enviar despesa", async () => {
    const { app, called } = buildApp(vaultOpen, [PERMISSIONS.PROPOSALS_READ]);
    const base = await listen(app);

    const envio = await fetch(`${base}/api/v1/vault/business/allocations/abc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(CORPO_VALIDO),
    });
    expect(envio.status).toBe(403);

    const leitura = await fetch(`${base}/api/v1/vault/business/allocations`);
    expect(leitura.status).toBe(200);

    expect(called).toEqual(["list"]);
  });

  it("com Cofre aberto e permissão, chega ao controller", async () => {
    const { app, called } = buildApp(vaultOpen, TUDO);
    const base = await listen(app);

    for (const rota of ROTAS) await chamar(base, rota);

    expect(called).toEqual(["list", "listPlans", "status", "push", "sync", "revert"]);
  });
});

describe("cobertura da lista de rotas", () => {
  it("a lista acima cobre todas as rotas registradas", async () => {
    const { controller } = stubController();
    const router = createVaultBridgeRoutes(controller, fakeAuthenticate(TUDO), vaultOpen);

    const registradas = router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) => {
        const route = layer.route as unknown as { path: string; methods: Record<string, boolean> };
        return Object.keys(route.methods).map((method) => `${method} ${route.path}`);
      });

    const listadas = new Set(
      ROTAS.map(({ method, path }) => `${method} ${path.replace(/abc/g, ":x")}`),
    );
    const naoListadas = registradas.filter(
      (entry) => !listadas.has(entry.replace(/:[a-zA-Z]+/g, ":x")),
    );

    // Uma rota nova aqui sem entrada na lista não seria testada contra o RBAC —
    // e é justamente o RBAC que impede a ponte de virar atalho.
    expect(naoListadas).toEqual([]);
  });
});
