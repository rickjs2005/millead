import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { PersonalCatalogRepository } from "../../domain/repositories/personal-catalog-repository.js";
import type {
  CreateSubscriptionInput,
  NewAlert,
  PersonalAlert,
  PersonalSubscription,
  PersonalSubscriptionRepository,
  SubscriptionChargeCandidate,
} from "../../domain/repositories/personal-subscription-repository.js";
import type { PushSender } from "../../domain/services/push-sender.js";
import { PersonalSubscriptionService } from "./personal-subscription-service.js";
import { formatUtcDate, utcDate } from "./vault-date.js";

const VAULT = "vault-1";
const ORG = "org-1";
const HOJE = utcDate(2026, 8, 20);
const MERCHANT_CLAUDE = "m-claude";

function subscription(over: Partial<PersonalSubscription> = {}): PersonalSubscription {
  return {
    id: "sub-claude",
    vaultId: VAULT,
    name: "Claude",
    merchantId: MERCHANT_CLAUDE,
    categoryId: "cat-ia",
    accountId: null,
    cardId: "card-1",
    expectedCents: 12000,
    currency: "BRL",
    period: "MONTHLY",
    customIntervalDays: null,
    lastChargeAt: utcDate(2026, 7, 21),
    nextRenewalAt: utcDate(2026, 8, 21),
    alertDaysBefore: 7,
    priceTolerancePct: 10,
    status: "ACTIVE",
    autoRenew: true,
    costSubscriptionId: null,
    notes: null,
    ...over,
  };
}

function charge(over: Partial<SubscriptionChargeCandidate> = {}): SubscriptionChargeCandidate {
  return {
    id: "tx-1",
    merchantId: MERCHANT_CLAUDE,
    normalizedDescription: "ANTHROPIC CLAUDE",
    transactionDate: utcDate(2026, 8, 21),
    amountCents: 12000,
    ...over,
  };
}

function makeFakes(
  options: {
    subs?: PersonalSubscription[];
    charges?: SubscriptionChargeCandidate[];
    /** Plano de custo existe na organização? O teste da lacuna da fase 5
     *  passa `false` — antes dela, qualquer id era aceito. */
    planoExiste?: boolean;
  } = {},
) {
  const planoExiste = options.planoExiste ?? true;
  const subs = options.subs ?? [subscription()];
  const unlinked = options.charges ?? [];
  const alerts: PersonalAlert[] = [];
  const linked: Array<{ transactionId: string; subscriptionId: string }> = [];
  let seq = 0;

  const repo: PersonalSubscriptionRepository = {
    list: async (_v, status) => (status ? subs.filter((s) => s.status === status) : subs),
    listActive: async () => subs.filter((s) => s.status === "ACTIVE"),
    findById: async (_v, id) => subs.find((s) => s.id === id) ?? null,
    findActiveByMerchant: async (_v, merchantId) =>
      subs.find((s) => s.merchantId === merchantId && s.status === "ACTIVE") ?? null,
    create: async (_v, input: CreateSubscriptionInput) => {
      const created: PersonalSubscription = { id: `sub-${++seq}`, vaultId: VAULT, ...input };
      subs.push(created);
      return created;
    },
    update: async (_v, id, patch) => {
      const found = subs.find((s) => s.id === id);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    delete: async (_v, id) => {
      const i = subs.findIndex((s) => s.id === id);
      if (i < 0) return false;
      subs.splice(i, 1);
      return true;
    },
    listCharges: async () => [],
    listUnlinkedCharges: async () =>
      unlinked.filter((c) => !linked.some((l) => l.transactionId === c.id)),
    linkCharge: async (_v, transactionId, subscriptionId) => {
      linked.push({ transactionId, subscriptionId });
      return true;
    },
    createAlerts: async (_v, novos: readonly NewAlert[]) => {
      let count = 0;
      for (const alert of novos) {
        // Espelha o unique de dedupeKey do banco.
        if (alerts.some((a) => a.dedupeKey === alert.dedupeKey)) continue;
        alerts.push({
          id: `al-${alerts.length + 1}`,
          vaultId: VAULT,
          status: "PENDING",
          snoozedUntil: null,
          readAt: null,
          createdAt: new Date(),
          ...alert,
        });
        count++;
      }
      return count;
    },
    listActionable: async (_v, today) =>
      alerts.filter(
        (a) =>
          a.status === "PENDING" ||
          (a.status === "SNOOZED" && a.snoozedUntil !== null && a.snoozedUntil <= today),
      ),
    countActionable: async (_v, today) => (await repo.listActionable(_v, today)).length,
    markRead: async (_v, id, readAt) => {
      const found = alerts.find((a) => a.id === id);
      if (!found) return null;
      found.status = "READ";
      found.readAt = readAt;
      return found;
    },
    snooze: async (_v, id, until) => {
      const found = alerts.find((a) => a.id === id);
      if (!found) return null;
      found.status = "SNOOZED";
      found.snoozedUntil = until;
      return found;
    },
  };

  const catalog = {
    findCategory: async () => ({ id: "cat-ia" }),
    findMerchant: async () => ({ id: MERCHANT_CLAUDE }),
  } as unknown as PersonalCatalogRepository;

  const push: PushSender = {
    sendToOrg: vi.fn(async () => undefined),
    sendToUser: vi.fn(async () => undefined),
  };

  // Plano de custo existe por padrão; o teste da lacuna da fase 5 troca isto.
  const costPlans = { costSubscriptionExists: async () => planoExiste };
  const service = new PersonalSubscriptionService(repo, catalog, push, costPlans);
  return { service, subs, alerts, linked, push };
}

let f: ReturnType<typeof makeFakes>;
beforeEach(() => {
  f = makeFakes();
});

describe("criação", () => {
  it("calcula a próxima renovação a partir da última cobrança", async () => {
    const criada = await f.service.create(VAULT, ORG, {
      ...subscription({ nextRenewalAt: null, lastChargeAt: utcDate(2026, 8, 5) }),
      id: undefined,
      vaultId: undefined,
    } as never);
    expect(formatUtcDate(criada.nextRenewalAt!)).toBe("2026-09-05");
  });

  it("sem última cobrança, a renovação fica em aberto até a primeira aparecer", async () => {
    const criada = await f.service.create(VAULT, ORG, {
      ...subscription({ nextRenewalAt: null, lastChargeAt: null }),
      id: undefined,
      vaultId: undefined,
    } as never);
    expect(criada.nextRenewalAt).toBeNull();
  });

  it("periodicidade personalizada exige o intervalo", async () => {
    await expect(
      f.service.create(VAULT, ORG, {
        ...subscription({ period: "CUSTOM", customIntervalDays: null }),
        id: undefined,
        vaultId: undefined,
      } as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("intervalo em dias só vale pra periodicidade personalizada", async () => {
    await expect(
      f.service.create(VAULT, ORG, {
        ...subscription({ period: "MONTHLY", customIntervalDays: 30 }),
        id: undefined,
        vaultId: undefined,
      } as never),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("edição", () => {
  it("mudar a periodicidade recalcula a próxima renovação", async () => {
    // Sem recalcular, o alerta continuaria no ritmo antigo e chegaria no dia
    // errado sem nada denunciando.
    const atualizada = await f.service.update(VAULT, ORG, "sub-claude", { period: "YEARLY" });
    expect(formatUtcDate(atualizada.nextRenewalAt!)).toBe("2027-07-21");
  });

  it("informar a renovação à mão vence o recálculo", async () => {
    const atualizada = await f.service.update(VAULT, ORG, "sub-claude", {
      period: "YEARLY",
      nextRenewalAt: utcDate(2026, 12, 1),
    });
    expect(formatUtcDate(atualizada.nextRenewalAt!)).toBe("2026-12-01");
  });

  it("assinatura inexistente é 404", async () => {
    await expect(f.service.update(VAULT, ORG, "nao-existe", { name: "X" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("refresh — o fluxo do exemplo do Claude", () => {
  it("casa a cobrança, avança a renovação e avisa que renova amanhã", async () => {
    f = makeFakes({
      subs: [
        subscription({ lastChargeAt: utcDate(2026, 7, 21), nextRenewalAt: utcDate(2026, 8, 21) }),
      ],
      charges: [charge({ transactionDate: utcDate(2026, 7, 21) })],
    });

    const resultado = await f.service.refresh(VAULT, HOJE);

    expect(resultado.cobrancasVinculadas).toBe(1);
    expect(f.linked).toEqual([{ transactionId: "tx-1", subscriptionId: "sub-claude" }]);
    // A cobrança de 21/07 empurra a renovação pra 21/08 — amanhã.
    expect(formatUtcDate(f.subs[0]!.nextRenewalAt!)).toBe("2026-08-21");
    expect(f.alerts.map((a) => a.type)).toContain("RENEWS_TOMORROW");
  });

  it("o alerta carrega o valor esperado, como o exemplo pede", async () => {
    await f.service.refresh(VAULT, HOJE);
    const alerta = f.alerts.find((a) => a.type === "RENEWS_TOMORROW");
    expect(alerta!.payload).toMatchObject({ name: "Claude", expectedAmount: "120.00" });
  });

  it("cobrança fora da tolerância gera alerta de variação", async () => {
    f = makeFakes({ charges: [charge({ amountCents: 15000 })] });
    await f.service.refresh(VAULT, HOJE);
    expect(f.alerts.map((a) => a.type)).toContain("PRICE_CHANGED");
  });

  it("extrato antigo NÃO empurra a renovação pra trás", async () => {
    // Importar um extrato de meses atrás não pode reescrever a próxima
    // renovação com uma data que já passou.
    f = makeFakes({
      subs: [
        subscription({ lastChargeAt: utcDate(2026, 7, 21), nextRenewalAt: utcDate(2026, 8, 21) }),
      ],
      charges: [charge({ id: "tx-antiga", transactionDate: utcDate(2026, 3, 10) })],
    });

    await f.service.refresh(VAULT, HOJE);

    expect(formatUtcDate(f.subs[0]!.nextRenewalAt!)).toBe("2026-08-21");
  });
});

describe("refresh — idempotência", () => {
  it("rodar duas vezes no mesmo dia não duplica alerta", async () => {
    // É o que permite verificar a cada abertura do app sem encher a tela.
    const primeira = await f.service.refresh(VAULT, HOJE);
    const segunda = await f.service.refresh(VAULT, HOJE);

    expect(primeira.novosAlertas).toBeGreaterThan(0);
    expect(segunda.novosAlertas).toBe(0);
    expect(f.alerts).toHaveLength(primeira.novosAlertas);
  });
});

describe("refresh — notificação", () => {
  it("push vai só pro dono, nunca pra organização", async () => {
    // O vazamento que a fase 1 anotou: `sendToOrg` mandaria "Claude renova
    // amanhã — R$120" pro navegador de toda a equipe.
    await f.service.refresh(VAULT, HOJE, "user-dono");

    expect(f.push.sendToUser).toHaveBeenCalledTimes(1);
    expect(f.push.sendToOrg).not.toHaveBeenCalled();
  });

  it("sem alerta novo, não notifica", async () => {
    await f.service.refresh(VAULT, HOJE, "user-dono");
    await f.service.refresh(VAULT, HOJE, "user-dono");
    expect(f.push.sendToUser).toHaveBeenCalledTimes(1);
  });

  it("falha no push não derruba a verificação", async () => {
    (f.push.sendToUser as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    await expect(f.service.refresh(VAULT, HOJE, "user-dono")).resolves.toBeDefined();
  });
});

describe("sugestão de assinatura nova", () => {
  it("duas cobranças mensais sem assinatura viram sugestão", async () => {
    f = makeFakes({
      subs: [],
      charges: [
        charge({
          id: "tx-1",
          merchantId: "m-netflix",
          transactionDate: utcDate(2026, 7, 10),
          amountCents: 5590,
        }),
        charge({
          id: "tx-2",
          merchantId: "m-netflix",
          transactionDate: utcDate(2026, 8, 10),
          amountCents: 5590,
        }),
      ],
    });

    await f.service.refresh(VAULT, HOJE);

    const sugestao = f.alerts.find((a) => a.type === "POSSIBLE_NEW_SUBSCRIPTION");
    expect(sugestao).toBeDefined();
    expect(sugestao!.payload).toMatchObject({
      period: "MONTHLY",
      expectedAmount: "55.90",
      occurrences: 2,
    });
  });

  it("uma cobrança só NÃO vira sugestão", async () => {
    f = makeFakes({
      subs: [],
      charges: [charge({ id: "tx-1", merchantId: "m-netflix" })],
    });
    await f.service.refresh(VAULT, HOJE);
    expect(f.alerts.map((a) => a.type)).not.toContain("POSSIBLE_NEW_SUBSCRIPTION");
  });

  it("sugestão NÃO cria assinatura sozinha", async () => {
    // Uma assinatura criada automaticamente começaria a gerar alertas que
    // ninguém pediu, com valor e data que ninguém conferiu.
    f = makeFakes({
      subs: [],
      charges: [
        charge({ id: "tx-1", merchantId: "m-netflix", transactionDate: utcDate(2026, 7, 10) }),
        charge({ id: "tx-2", merchantId: "m-netflix", transactionDate: utcDate(2026, 8, 10) }),
      ],
    });

    await f.service.refresh(VAULT, HOJE);

    expect(f.subs).toEqual([]);
  });

  it("fornecedor que já tem assinatura não vira sugestão de novo", async () => {
    f = makeFakes({
      charges: [
        charge({ id: "tx-1", transactionDate: utcDate(2026, 6, 21) }),
        charge({ id: "tx-2", transactionDate: utcDate(2026, 7, 21) }),
      ],
    });
    await f.service.refresh(VAULT, HOJE);
    expect(f.alerts.map((a) => a.type)).not.toContain("POSSIBLE_NEW_SUBSCRIPTION");
  });
});

describe("central de alertas", () => {
  it("marcar como lido tira da lista", async () => {
    await f.service.refresh(VAULT, HOJE);
    const alerta = f.alerts[0]!;

    await f.service.markAlertRead(VAULT, alerta.id);

    expect(await f.service.listAlerts(VAULT, HOJE)).not.toContainEqual(
      expect.objectContaining({ id: alerta.id }),
    );
  });

  it("adiar esconde até a data e depois devolve", async () => {
    // "Adiar" que esconde pra sempre não é adiar.
    await f.service.refresh(VAULT, HOJE);
    const alerta = f.alerts[0]!;

    await f.service.snoozeAlert(VAULT, alerta.id, utcDate(2026, 8, 25));

    expect(await f.service.countAlerts(VAULT, HOJE)).toBe(f.alerts.length - 1);
    expect(await f.service.countAlerts(VAULT, utcDate(2026, 8, 26))).toBe(f.alerts.length);
  });

  it("alerta inexistente é 404", async () => {
    await expect(f.service.markAlertRead(VAULT, "nao-existe")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("assinatura pausada", () => {
  it("não gera alerta nenhum", async () => {
    f = makeFakes({ subs: [subscription({ status: "PAUSED" })] });
    const resultado = await f.service.refresh(VAULT, HOJE);
    expect(resultado.novosAlertas).toBe(0);
  });
});

describe("vínculo com o plano de custo da MilWeb", () => {
  it("recusa apontar para uma assinatura de custo de outra organização", async () => {
    // Lacuna aberta na fase 5: `costSubscriptionId` era gravado sem conferir
    // nada, e um id de outra organização passava batido. Não há FK entre os
    // dois mundos que impeça isso — a checagem é o que faz esse papel.
    const f = makeFakes({ planoExiste: false });

    await expect(
      f.service.create(VAULT, ORG, {
        ...subscription({ costSubscriptionId: "plan-de-outra-org" }),
        id: undefined,
        vaultId: undefined,
      } as never),
    ).rejects.toThrow(/não encontrada nesta organização/);
    expect(f.subs).toHaveLength(1); // só a que o fake já trazia
  });

  it("aceita quando o plano é da organização", async () => {
    const f = makeFakes({ planoExiste: true });
    const criada = await f.service.create(VAULT, ORG, {
      ...subscription({ costSubscriptionId: "plan-claude" }),
      id: undefined,
      vaultId: undefined,
    } as never);
    expect(criada.costSubscriptionId).toBe("plan-claude");
  });
});
