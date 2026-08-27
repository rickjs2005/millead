import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../domain/errors/app-error.js";
import type { PersonalVaultController } from "../controllers/personal-vault-controller.js";
import { errorHandler } from "../middlewares/error-handler.js";
import { createVaultRoutes } from "./vault-routes.js";

/**
 * Teste de rota de verdade (Express numa porta efêmera), no mesmo espírito do
 * post-sale-routes.test.ts.
 *
 * O que precisa ser provado aqui não é o CRUD: é que o Cofre NÃO depende do
 * RBAC da organização. Um usuário sem permissão nenhuma tem que chegar ao
 * controller -- porque a autorização dele é posse do Cofre, não papel. Se
 * alguém "consertar" isso um dia pondo `requirePermission` nas rotas, o
 * Cofre passa a ser visível pro papel Admin de toda organização
 * (ADMIN_PERMISSIONS = ALL_PERMISSIONS menos billing), e este teste cai.
 */
function fakeAuthenticate(userId = "user-1"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Zero permissões de propósito.
    req.auth = {
      userId,
      organizationId: "org-1",
      permissions: [],
    } as unknown as Request["auth"];
    next();
  };
}

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

function stubController(overrides: Partial<Record<string, RequestHandler>> = {}) {
  return {
    exists: vi.fn(async (_req: Request, res: Response) => void res.json({ exists: true })),
    status: vi.fn(async (_req: Request, res: Response) => void res.json({ enabled: true })),
    create: vi.fn(async (_req: Request, res: Response) => void res.status(201).json({})),
    unlock: vi.fn(async (_req: Request, res: Response) => void res.json({ token: "tok" })),
    lock: vi.fn(async (_req: Request, res: Response) => void res.status(204).send()),
    ...overrides,
  } as unknown as PersonalVaultController & Record<string, ReturnType<typeof vi.fn>>;
}

/** `requireVault` de mentira: as rotas desta fase que importam ficam antes
 *  dele, e o middleware de verdade tem teste próprio (require-vault.test.ts). */
const passthroughVault: RequestHandler = (_req, _res, next) => next();

function buildApp(
  controller: PersonalVaultController,
  authenticate = fakeAuthenticate(),
  configured = true,
) {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/vault",
    createVaultRoutes(controller, authenticate, passthroughVault, { configured }),
  );
  app.use(errorHandler);
  return app;
}

describe("createVaultRoutes", () => {
  it("usuário SEM permissão nenhuma chega ao controller (Cofre não usa RBAC)", async () => {
    const controller = stubController();
    const base = await listen(buildApp(controller));

    const res = await fetch(`${base}/api/v1/vault/status`);

    expect(res.status).toBe(200);
    expect(controller.status).toHaveBeenCalled();
  });

  it("404 do serviço sai como 404 no corpo padrão, sem detalhe do Cofre", async () => {
    const controller = stubController({
      status: vi.fn(async () => {
        throw new NotFoundError("Rota não encontrada.");
      }) as never,
    });
    const base = await listen(buildApp(controller));

    const res = await fetch(`${base}/api/v1/vault/status`);
    const body = (await res.json()) as { error: { code: string; message: string } };

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
    // A mensagem é a mesma de qualquer rota inexistente -- não confirma que
    // existe um Cofre, nem de quem ele é.
    expect(body.error.message).toBe("Rota não encontrada.");
    expect(JSON.stringify(body)).not.toMatch(/vault|cofre/i);
  });

  it("unlock exige senha no corpo (422 antes de tocar no controller)", async () => {
    const controller = stubController();
    const base = await listen(buildApp(controller));

    const res = await fetch(`${base}/api/v1/vault/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(422);
    expect(controller.unlock).not.toHaveBeenCalled();
  });

  it("unlock com senha chega ao controller", async () => {
    const controller = stubController();
    const base = await listen(buildApp(controller));

    const res = await fetch(`${base}/api/v1/vault/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "abc" }),
    });

    expect(res.status).toBe(200);
    expect(controller.unlock).toHaveBeenCalled();
  });

  it("lock responde 204", async () => {
    const controller = stubController();
    const base = await listen(buildApp(controller));

    const res = await fetch(`${base}/api/v1/vault/lock`, { method: "POST" });
    expect(res.status).toBe(204);
  });

  it("sem sessão o roteador nem chega ao controller", async () => {
    const controller = stubController();
    const semSessao: RequestHandler = (_req, res) => {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Token ausente." } });
    };
    const base = await listen(buildApp(controller, semSessao));

    const res = await fetch(`${base}/api/v1/vault/status`);

    expect(res.status).toBe(401);
    expect(controller.status).not.toHaveBeenCalled();
  });
});

describe("sem VAULT_SESSION_SECRET, o módulo inteiro some", () => {
  // Encontrado no primeiro deploy em produção, com a variável ainda ausente no
  // Render: `/status` respondia 200 e `/unlock` estourava 500. A tela mostrava
  // "Criar Cofre" pra um Cofre que já existia, e o botão de abrir quebrava --
  // um estado que parece defeito do sistema, não configuração faltando.
  const ROTAS: ReadonlyArray<{ method: "get" | "post"; path: string; body?: unknown }> = [
    { method: "get", path: "/status" },
    { method: "post", path: "/" },
    { method: "post", path: "/unlock", body: { password: "seja-la-qual-for" } },
    { method: "post", path: "/lock" },
    { method: "get", path: "/session" },
  ];

  it.each(ROTAS)("$method $path responde 404", async ({ method, path, body }) => {
    const controller = stubController();
    const base = await listen(buildApp(controller, fakeAuthenticate(), false));

    const res = await fetch(`${base}/api/v1/vault${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    // 404, e não 500 nem 200: sem o segredo o módulo tem de ficar
    // indistinguível de um que nunca existiu -- inclusive pra quem sonda de
    // fora, pra quem a diferença entre 500 e 404 já denunciaria que existe
    // algo ali meio instalado.
    expect(res.status).toBe(404);
  });

  it("nenhuma delas alcança o controller", async () => {
    const controller = stubController();
    const base = await listen(buildApp(controller, fakeAuthenticate(), false));

    for (const { method, path, body } of ROTAS) {
      await fetch(`${base}/api/v1/vault${path}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    }

    for (const [nome, fn] of Object.entries(controller)) {
      expect(fn, `controller.${nome} não devia ter sido chamado`).not.toHaveBeenCalled();
    }
  });
});
