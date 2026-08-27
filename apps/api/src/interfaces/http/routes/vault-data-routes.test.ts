import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VaultLockedError } from "../../../domain/errors/app-error.js";
import type { PersonalFinanceController } from "../controllers/personal-finance-controller.js";
import { errorHandler } from "../middlewares/error-handler.js";
import { createVaultDataRoutes } from "./vault-data-routes.js";

/**
 * O que precisa ser provado aqui não é o CRUD — é que **nenhuma rota de dados
 * do Cofre existe fora da sessão elevada**, e que nenhuma delas depende do RBAC
 * da organização.
 *
 * A lista abaixo é varrida rota a rota de propósito: uma rota nova adicionada
 * sem passar pelo router protegido não aparece nela e, se alguém montá-la fora,
 * o teste de cobertura no fim do arquivo acusa.
 */
const ROTAS: ReadonlyArray<{ method: "get" | "post" | "patch" | "put" | "delete"; path: string }> =
  [
    { method: "get", path: "/accounts" },
    { method: "post", path: "/accounts" },
    { method: "get", path: "/accounts/abc" },
    { method: "patch", path: "/accounts/abc" },
    { method: "delete", path: "/accounts/abc" },
    { method: "get", path: "/cards" },
    { method: "post", path: "/cards" },
    { method: "get", path: "/cards/abc" },
    { method: "patch", path: "/cards/abc" },
    { method: "delete", path: "/cards/abc" },
    { method: "get", path: "/categories" },
    { method: "post", path: "/categories" },
    { method: "patch", path: "/categories/abc" },
    { method: "delete", path: "/categories/abc" },
    { method: "get", path: "/merchants" },
    { method: "post", path: "/merchants" },
    { method: "get", path: "/merchants/abc" },
    { method: "patch", path: "/merchants/abc" },
    { method: "delete", path: "/merchants/abc" },
    { method: "post", path: "/merchants/abc/aliases" },
    { method: "delete", path: "/merchants/abc/aliases/def" },
    { method: "get", path: "/transactions" },
    { method: "post", path: "/transactions" },
    { method: "post", path: "/transactions/transfers" },
    { method: "get", path: "/transactions/abc" },
    { method: "patch", path: "/transactions/abc" },
    { method: "delete", path: "/transactions/abc" },
    { method: "put", path: "/transactions/abc/splits" },
    { method: "get", path: "/subscriptions" },
    { method: "post", path: "/subscriptions" },
    { method: "get", path: "/subscriptions/abc" },
    { method: "patch", path: "/subscriptions/abc" },
    { method: "delete", path: "/subscriptions/abc" },
    { method: "post", path: "/alerts/refresh" },
    { method: "get", path: "/alerts/count" },
    { method: "get", path: "/alerts" },
    { method: "patch", path: "/alerts/abc/read" },
    { method: "patch", path: "/alerts/abc/snooze" },
    { method: "get", path: "/rules" },
    { method: "post", path: "/rules" },
    { method: "patch", path: "/rules/abc" },
    { method: "delete", path: "/rules/abc" },
    { method: "post", path: "/classification/run" },
    { method: "patch", path: "/transactions/abc/classification" },
    { method: "get", path: "/imports" },
    { method: "post", path: "/imports" },
    { method: "post", path: "/imports/preview" },
    { method: "get", path: "/imports/profiles" },
    { method: "post", path: "/imports/profiles" },
    { method: "patch", path: "/imports/profiles/abc" },
    { method: "delete", path: "/imports/profiles/abc" },
    { method: "get", path: "/statements" },
    { method: "get", path: "/statements/abc" },
    { method: "post", path: "/statements/abc/payments" },
    { method: "get", path: "/contacts" },
    { method: "post", path: "/contacts" },
    { method: "patch", path: "/contacts/abc" },
    { method: "delete", path: "/contacts/abc" },
    { method: "get", path: "/debts/summary" },
    { method: "get", path: "/debts" },
    { method: "post", path: "/debts" },
    { method: "get", path: "/debts/abc" },
    { method: "patch", path: "/debts/abc" },
    { method: "delete", path: "/debts/abc" },
    { method: "post", path: "/debts/abc/payments" },
    { method: "delete", path: "/debts/abc/payments/def" },
  ];

function fakeAuthenticate(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    // Zero permissões: o Cofre não pode depender de RBAC.
    req.auth = {
      userId: "u1",
      organizationId: "org-1",
      permissions: [],
    } as unknown as Request["auth"];
    next();
  };
}

/** Recusa como o `requireVault` de verdade recusa quando não há sessão elevada. */
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

/** Controller que só registra quem foi chamado — nenhuma lógica de negócio. */
function stubController() {
  const called: string[] = [];
  const handler = (name: string) => async (_req: Request, res: Response) => {
    called.push(name);
    res.status(200).json({ ok: true });
  };
  const names = [
    "listAccounts",
    "getAccount",
    "createAccount",
    "updateAccount",
    "deleteAccount",
    "listCards",
    "getCard",
    "createCard",
    "updateCard",
    "deleteCard",
    "listCategories",
    "createCategory",
    "updateCategory",
    "deleteCategory",
    "listMerchants",
    "getMerchant",
    "createMerchant",
    "updateMerchant",
    "deleteMerchant",
    "addAlias",
    "removeAlias",
    "listTransactions",
    "getTransaction",
    "createTransaction",
    "updateTransaction",
    "deleteTransaction",
    "replaceSplits",
    "createTransfer",
    "listStatements",
    "getStatement",
    "payStatement",
    "listContacts",
    "createContact",
    "updateContact",
    "deleteContact",
    "listDebts",
    "debtSummary",
    "createDebt",
    "getDebt",
    "updateDebt",
    "deleteDebt",
    "addDebtPayment",
    "deleteDebtPayment",
  ];
  const controller = Object.fromEntries(names.map((name) => [name, vi.fn(handler(name))]));
  return { controller: controller as unknown as PersonalFinanceController, called };
}

function buildApp(requireVault: RequestHandler) {
  const { controller, called } = stubController();
  const app = express();
  app.use(express.json());
  app.use("/api/v1/vault", createVaultDataRoutes(controller, fakeAuthenticate(), requireVault));
  app.use(errorHandler);
  return { app, called };
}

describe("createVaultDataRoutes — sessão elevada", () => {
  it.each(ROTAS)("$method $path exige sessão elevada", async ({ method, path }) => {
    const { app, called } = buildApp(vaultLocked);
    const base = await listen(app);

    const res = await fetch(`${base}/api/v1/vault${path}`, {
      method: method.toUpperCase(),
      headers: { "content-type": "application/json" },
      body: method === "get" || method === "delete" ? undefined : "{}",
    });
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(401);
    expect(body.error.code).toBe("VAULT_LOCKED");
    // O controller nem foi alcançado -- a barreira está ANTES da lógica.
    expect(called).toEqual([]);
  });
});

describe("createVaultDataRoutes — sem RBAC", () => {
  it("usuário sem permissão nenhuma chega ao controller quando o Cofre está aberto", async () => {
    const { app, called } = buildApp(vaultOpen);
    const base = await listen(app);

    const res = await fetch(`${base}/api/v1/vault/accounts`);

    expect(res.status).toBe(200);
    expect(called).toEqual(["listAccounts"]);
  });
});

describe("createVaultDataRoutes — ordem das rotas", () => {
  it('"/transactions/transfers" não é engolido por "/transactions/:id"', async () => {
    // Express casa na ordem de declaração. Invertida, "transfers" viraria um id
    // e a transferência cairia no handler de detalhe -- que responderia 200 com
    // a movimentação errada, sem erro nenhum à vista.
    const { app, called } = buildApp(vaultOpen);
    const base = await listen(app);

    // Corpo válido de propósito: com corpo inválido a validação responderia
    // 422 antes do controller, e o teste passaria mesmo com a ordem errada.
    await fetch(`${base}/api/v1/vault/transactions/transfers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fromAccountId: "acc-1",
        toAccountId: "acc-2",
        date: "2026-08-27",
        amount: "100.00",
      }),
    });

    expect(called).toEqual(["createTransfer"]);
  });

  it('"/debts/summary" não é engolido por "/debts/:id"', async () => {
    // Mesmo risco do caso acima, com um agravante: aqui o handler errado
    // responderia 404 "dívida não encontrada" -- e o resumo simplesmente não
    // apareceria, como se não houvesse dívida nenhuma.
    const { app, called } = buildApp(vaultOpen);
    const base = await listen(app);

    await fetch(`${base}/api/v1/vault/debts/summary`);

    expect(called).toEqual(["debtSummary"]);
  });
});

describe("cobertura da lista de rotas", () => {
  it("a lista acima cobre todas as rotas registradas", async () => {
    const { controller } = stubController();
    const router = createVaultDataRoutes(controller, fakeAuthenticate(), vaultOpen);

    // `router.stack` é interno do Express, e normalmente inspecioná-lo é um
    // cheiro. Aqui é o ponto: se alguém adicionar uma rota nova e não puser na
    // lista de cima, ela não seria testada contra a sessão elevada -- e este
    // teste é o que impede isso de passar despercebido.
    const registradas = router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) => {
        const route = layer.route as unknown as { path: string; methods: Record<string, boolean> };
        return Object.keys(route.methods).map((method) => `${method} ${route.path}`);
      });

    const listadas = new Set(
      ROTAS.map(({ method, path }) => `${method} ${path.replace(/abc|def/g, ":x")}`),
    );
    const naoListadas = registradas.filter((entry) => {
      const normalizada = entry.replace(/:[a-zA-Z]+/g, ":x");
      return !listadas.has(normalizada);
    });

    expect(naoListadas).toEqual([]);
  });
});
