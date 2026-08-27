import { describe, expect, it } from "vitest";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type {
  BusinessExpense,
  BusinessExpenseRepository,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "../../domain/repositories/business-expense-repository.js";
import { BusinessExpenseService } from "./business-expense-service.js";
import { utcDate } from "./vault-date.js";

const ORG = "org-1";

function makeFakes(planosDaOrg: string[] = ["plan-claude"]) {
  const expenses: BusinessExpense[] = [];
  let seq = 0;

  const expenseRepo = {
    async list() {
      return expenses;
    },
    async findById(organizationId: string, id: string) {
      return expenses.find((e) => e.id === id && e.organizationId === organizationId) ?? null;
    },
    async create(organizationId: string, input: CreateExpenseInput) {
      const created: BusinessExpense = {
        id: `exp-${++seq}`,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      expenses.push(created);
      return created;
    },
    async update(organizationId: string, id: string, patch: UpdateExpenseInput) {
      const found = expenses.find((e) => e.id === id && e.organizationId === organizationId);
      if (!found) return null;
      Object.assign(found, patch);
      return found;
    },
    async delete(organizationId: string, id: string) {
      const i = expenses.findIndex((e) => e.id === id && e.organizationId === organizationId);
      if (i < 0) return false;
      expenses.splice(i, 1);
      return true;
    },
    async costSubscriptionExists(_org: string, id: string) {
      return planosDaOrg.includes(id);
    },
  } as unknown as BusinessExpenseRepository;

  const costRepo = {
    async listSubscriptions() {
      return [
        {
          id: "plan-claude",
          name: "Claude",
          scope: "AGENCY",
          amount: "20",
          currency: "USD",
          billingCycle: "MONTHLY",
          isActive: true,
        },
      ];
    },
    async getSettings() {
      return { usdToBrlRate: "5" };
    },
  } as unknown as CostRepository;

  return { service: new BusinessExpenseService(expenseRepo, costRepo), expenses };
}

const lancamento = {
  description: "Domínio milweb.com.br",
  amount: "60.00",
  currency: "BRL" as const,
  incurredAt: utcDate(2026, 8, 5),
  category: "DOMAIN" as const,
  costSubscriptionId: null,
  companyId: null,
  notes: null,
};

describe("lançamento manual", () => {
  it("nasce marcado como MANUAL", async () => {
    const f = makeFakes();
    const criada = await f.service.create(ORG, lancamento);
    expect(criada.source).toBe("MANUAL");
  });

  it("recusa plano de custo de outra organização", async () => {
    const f = makeFakes(["plan-claude"]);
    await expect(
      f.service.create(ORG, { ...lancamento, costSubscriptionId: "plan-de-outra-org" }),
    ).rejects.toThrow(/não encontrada nesta organização/);
    expect(f.expenses).toHaveLength(0);
  });
});

describe("despesa vinda do Cofre", () => {
  it("não deixa editar o valor por aqui", async () => {
    // O valor vem do rateio da compra. Editar aqui criaria duas versões da
    // mesma verdade, e a próxima sincronização desfaria a edição sem avisar.
    const f = makeFakes();
    const criada = await f.service.create(ORG, lancamento);
    criada.source = "PERSONAL_VAULT";

    await expect(f.service.update(ORG, criada.id, { amount: "999.00" })).rejects.toThrow(
      /Ajuste o rateio na origem/,
    );
    expect(f.expenses[0]!.amount).toBe("60.00");
  });

  it("deixa editar o resto — descrição, categoria, plano", async () => {
    const f = makeFakes();
    const criada = await f.service.create(ORG, lancamento);
    criada.source = "PERSONAL_VAULT";

    const editada = await f.service.update(ORG, criada.id, {
      description: "Claude Pro — MilWeb",
      costSubscriptionId: "plan-claude",
    });
    expect(editada.description).toBe("Claude Pro — MilWeb");
    expect(editada.costSubscriptionId).toBe("plan-claude");
  });

  it("apagar pelo financeiro é permitido — desfaz o envio", async () => {
    // Recusar com 409 apontando pra um Cofre que quem está no financeiro nem
    // pode ver seria um erro impossível de resolver de onde a pessoa está.
    const f = makeFakes();
    const criada = await f.service.create(ORG, lancamento);
    criada.source = "PERSONAL_VAULT";

    await f.service.delete(ORG, criada.id);
    expect(f.expenses).toHaveLength(0);
  });
});

describe("resumo", () => {
  it("compara com o plano sem somar", async () => {
    const f = makeFakes();
    await f.service.create(ORG, {
      ...lancamento,
      amount: "120.00",
      costSubscriptionId: "plan-claude",
    });

    const resumo = await f.service.summary(ORG, {
      from: utcDate(2026, 8, 1),
      to: utcDate(2026, 8, 31),
    });

    expect(resumo.realizadoBrl).toBe(120);
    expect(resumo.planejadoBrl).toBe(100);
    expect(resumo.porPlano[0]!.diferencaBrl).toBe(20);
  });
});
