import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PermissionKey } from "@millead/database/permissions";
import type { PostSaleController } from "../controllers/post-sale-controller.js";
import type { SettingsController } from "../controllers/settings-controller.js";
import { errorHandler } from "../middlewares/error-handler.js";
import { createContractRoutes } from "./contract-routes.js";
import { createSettingsRoutes } from "./settings-routes.js";
import type { ContractController } from "../controllers/contract-controller.js";

/**
 * Teste de rota de verdade (Express + fetch numa porta efêmera), não uma
 * inspeção do `router.stack`. O que precisa ser provado aqui é o
 * COMPORTAMENTO -- "quem não tem settings:manage recebe 403 e o controller
 * nem é chamado" -- e isso só um request de ponta a ponta mostra.
 */
function fakeAuthenticate(permissions: PermissionKey[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.auth = {
      userId: "user-1",
      organizationId: "org-1",
      roleId: "role-1",
      roleName: "Teste",
      permissions,
    } as Request["auth"];
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

function stubPostSaleController() {
  return {
    getSettings: vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ settings: {}, missing: [] });
    }),
    updateSettings: vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ settings: {}, missing: [] });
    }),
    getExecution: vi.fn(async (_req: Request, res: Response) => {
      res.status(200).json({ execution: null });
    }),
    reprocess: vi.fn(async (_req: Request, res: Response) => {
      res.status(202).json({ execution: {} });
    }),
  } as unknown as PostSaleController & Record<string, ReturnType<typeof vi.fn>>;
}

const stubSettingsController = {
  updateProfile: vi.fn(),
  updateOrganization: vi.fn(),
  integrations: vi.fn(),
} as unknown as SettingsController;

const stubContractController = {
  create: vi.fn(),
  list: vi.fn(),
  kpis: vi.fn(),
  get: vi.fn(),
  updateStatus: vi.fn(),
  reprocess: vi.fn(),
  pdf: vi.fn(),
  signatureWebhook: vi.fn(),
} as unknown as ContractController;

async function settingsApp(permissions: PermissionKey[]) {
  const postSale = stubPostSaleController();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/settings",
    createSettingsRoutes(stubSettingsController, postSale, fakeAuthenticate(permissions)),
  );
  app.use(errorHandler);
  return { base: await listen(app), postSale };
}

describe("rotas de configuração da automação pós-fechamento", () => {
  it("15. usuário sem settings:manage recebe 403 ao tentar ALTERAR", async () => {
    const { base, postSale } = await settingsApp(["leads:read", "proposals:write"]);

    const res = await fetch(`${base}/api/v1/settings/post-sale-automation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });

    expect(res.status).toBe(403);
    expect(postSale.updateSettings).not.toHaveBeenCalled();
  });

  it("15b. usuário sem settings:manage também não LÊ a configuração", async () => {
    const { base, postSale } = await settingsApp(["leads:read"]);

    const res = await fetch(`${base}/api/v1/settings/post-sale-automation`);

    expect(res.status).toBe(403);
    expect(postSale.getSettings).not.toHaveBeenCalled();
  });

  it("com settings:manage a alteração passa e chega no controller", async () => {
    const { base, postSale } = await settingsApp(["settings:manage"]);

    const res = await fetch(`${base}/api/v1/settings/post-sale-automation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, installmentCount: 3 }),
    });

    expect(res.status).toBe(200);
    expect(postSale.updateSettings).toHaveBeenCalledTimes(1);
  });

  it("corpo inválido é recusado com 422 antes de chegar no controller", async () => {
    const { base, postSale } = await settingsApp(["settings:manage"]);

    const res = await fetch(`${base}/api/v1/settings/post-sale-automation`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installmentCount: 999 }), // acima do teto de 60
    });

    expect(res.status).toBe(422);
    expect(postSale.updateSettings).not.toHaveBeenCalled();
  });
});

describe("rotas de execução da automação no contrato", () => {
  async function contractsApp(permissions: PermissionKey[]) {
    const postSale = stubPostSaleController();
    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/contracts",
      createContractRoutes(stubContractController, postSale, fakeAuthenticate(permissions)),
    );
    app.use(errorHandler);
    return { base: await listen(app), postSale };
  }

  it("ler a execução exige proposals:read (mesma permissão do contrato)", async () => {
    const { base, postSale } = await contractsApp(["leads:read"]);

    const res = await fetch(`${base}/api/v1/contracts/contract-1/post-sale`);

    expect(res.status).toBe(403);
    expect(postSale.getExecution).not.toHaveBeenCalled();
  });

  it("reprocessar exige proposals:write -- leitura não basta", async () => {
    const { base, postSale } = await contractsApp(["proposals:read"]);

    const res = await fetch(`${base}/api/v1/contracts/contract-1/post-sale/reprocess`, {
      method: "POST",
    });

    expect(res.status).toBe(403);
    expect(postSale.reprocess).not.toHaveBeenCalled();
  });

  it("com proposals:write o reprocessamento responde 202 (roda no worker)", async () => {
    const { base, postSale } = await contractsApp(["proposals:read", "proposals:write"]);

    const res = await fetch(`${base}/api/v1/contracts/contract-1/post-sale/reprocess`, {
      method: "POST",
    });

    expect(res.status).toBe(202);
    expect(postSale.reprocess).toHaveBeenCalledTimes(1);
  });
});
