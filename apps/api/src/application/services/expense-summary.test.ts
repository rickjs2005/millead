import { describe, expect, it } from "vitest";
import { computeSummary } from "./cost-service.js";
import {
  summarizeExpenses,
  type ExpenseForSummary,
  type PlanForComparison,
} from "./expense-summary.js";

const RATE = 5;

function plano(over: Partial<PlanForComparison> = {}): PlanForComparison {
  return {
    id: "plan-claude",
    name: "Claude",
    amount: 20,
    currency: "USD",
    billingCycle: "MONTHLY",
    isActive: true,
    ...over,
  };
}

function despesa(over: Partial<ExpenseForSummary> = {}): ExpenseForSummary {
  return {
    id: "exp-1",
    costSubscriptionId: "plan-claude",
    amount: 120,
    currency: "BRL",
    source: "PERSONAL_VAULT",
    ...over,
  };
}

describe("planejado x realizado", () => {
  it("compara lado a lado — e a diferença é subtração, nunca soma", () => {
    const r = summarizeExpenses([despesa()], [plano()], RATE);

    expect(r.planejadoBrl).toBe(100); // US$20 × 5
    expect(r.realizadoBrl).toBe(120);
    // O erro que este arquivo existe pra impedir seria 220 em algum campo.
    expect(r.porPlano[0]!.diferencaBrl).toBe(20);
    expect(Object.values(r)).not.toContain(220);
  });

  it("nenhum campo do resumo é a soma dos dois", () => {
    const r = summarizeExpenses([despesa()], [plano()], RATE);
    const soma = r.planejadoBrl + r.realizadoBrl;

    const numeros = [
      r.planejadoBrl,
      r.realizadoBrl,
      r.doCofreBrl,
      r.semPlano.realizadoBrl,
      ...r.porPlano.flatMap((p) => [p.planejadoBrl, p.realizadoBrl, p.diferencaBrl]),
    ];
    expect(numeros).not.toContain(soma);
  });

  it("criar despesas NÃO mexe no resumo de custos", () => {
    // A prova estrutural: `computeSummary` nem recebe despesas. Este teste
    // fixa a consequência -- o custo mensal previsto da MilWeb é o mesmo antes
    // e depois de lançar o realizado, porque são duas perguntas diferentes.
    const antes = computeSummary(
      [{ ...plano(), scope: "AGENCY" as const, capacityUsed: null, capacityLimit: null }],
      { usdToBrlRate: RATE, activeClientsCount: 4 },
      3,
    );
    summarizeExpenses([despesa(), despesa({ id: "exp-2" })], [plano()], RATE);
    const depois = computeSummary(
      [{ ...plano(), scope: "AGENCY" as const, capacityUsed: null, capacityLimit: null }],
      { usdToBrlRate: RATE, activeClientsCount: 4 },
      3,
    );

    expect(depois.totalMonthlyBrl).toBe(antes.totalMonthlyBrl);
    expect(depois.totalMonthlyBrl).toBe(100);
  });

  it("plano sem cobrança no mês aparece com realizado zero", () => {
    // Omitir a linha esconderia que a cobrança ainda não entrou.
    const r = summarizeExpenses([], [plano()], RATE);
    expect(r.porPlano).toHaveLength(1);
    expect(r.porPlano[0]!.realizadoBrl).toBe(0);
    expect(r.porPlano[0]!.diferencaBrl).toBe(-100);
  });

  it("despesa sem plano fica no balde de sem plano", () => {
    const r = summarizeExpenses(
      [despesa({ costSubscriptionId: null, amount: 45 })],
      [plano()],
      RATE,
    );
    expect(r.semPlano).toEqual({ realizadoBrl: 45, lancamentos: 1 });
    expect(r.porPlano[0]!.realizadoBrl).toBe(0);
  });

  it("despesa apontando pra plano inativo ainda entra no total", () => {
    // Senão a soma das linhas não bateria com o total, e o dinheiro sumiria da
    // tela sem sumir da conta.
    const r = summarizeExpenses(
      [despesa({ costSubscriptionId: "plan-morto", amount: 30 })],
      [plano()],
      RATE,
    );
    expect(r.realizadoBrl).toBe(30);
    expect(r.semPlano.realizadoBrl).toBe(30);
  });

  it("separa quanto do realizado saiu do bolso do dono", () => {
    const r = summarizeExpenses(
      [despesa({ amount: 120 }), despesa({ id: "exp-2", amount: 80, source: "MANUAL" })],
      [plano()],
      RATE,
    );
    expect(r.realizadoBrl).toBe(200);
    expect(r.doCofreBrl).toBe(120); // é isto que a empresa deve ao dono
  });

  it("despesa em dólar é convertida; a do Cofre já vem em real", () => {
    const r = summarizeExpenses(
      [despesa({ amount: 20, currency: "USD", source: "MANUAL" })],
      [plano()],
      RATE,
    );
    expect(r.realizadoBrl).toBe(100);
  });

  it("plano anual é mensalizado antes de comparar", () => {
    const r = summarizeExpenses(
      [despesa({ amount: 100 })],
      [plano({ amount: 1200, currency: "BRL", billingCycle: "YEARLY" })],
      RATE,
    );
    expect(r.porPlano[0]!.planejadoBrl).toBe(100);
    expect(r.porPlano[0]!.diferencaBrl).toBe(0);
  });

  it("ordena por quem mais estourou", () => {
    const r = summarizeExpenses(
      [
        despesa({ id: "a", costSubscriptionId: "p1", amount: 300 }),
        despesa({ id: "b", costSubscriptionId: "p2", amount: 50 }),
      ],
      [
        plano({ id: "p1", name: "Um", amount: 100, currency: "BRL" }),
        plano({ id: "p2", name: "Dois", amount: 100, currency: "BRL" }),
      ],
      RATE,
    );
    expect(r.porPlano.map((p) => p.name)).toEqual(["Um", "Dois"]);
    expect(r.porPlano[0]!.diferencaBrl).toBe(200);
    expect(r.porPlano[1]!.diferencaBrl).toBe(-50);
  });
});
