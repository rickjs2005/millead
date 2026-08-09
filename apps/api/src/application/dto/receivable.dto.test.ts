import { describe, expect, it } from "vitest";
import {
  createPlanSchema,
  createStandaloneSchema,
  paySchema,
  receivableQuerySchema,
  receivableSeriesQuerySchema,
  updateReceivableSchema,
} from "./receivable.dto.js";

describe("createPlanSchema", () => {
  const BASE = {
    contractId: "contract-1",
    total: 1000,
    entryAmount: 400,
    entryDueDate: "2026-08-05",
    installments: [
      { amount: 200, dueDate: "2026-09-05" },
      { amount: 200, dueDate: "2026-10-05" },
      { amount: 200, dueDate: "2026-11-05" },
    ],
  };

  it("aceita um plano com shape válido", () => {
    const result = createPlanSchema.safeParse(BASE);
    expect(result.success).toBe(true);
  });

  it("não valida a composição (soma != total) no zod -- isso é responsabilidade do service", () => {
    const result = createPlanSchema.safeParse({ ...BASE, installments: [{ amount: 1, dueDate: "2026-09-05" }] });
    expect(result.success).toBe(true);
  });

  it("aceita installments vazio (shape-only; composição é do service)", () => {
    const result = createPlanSchema.safeParse({ ...BASE, entryAmount: 1000, installments: [] });
    expect(result.success).toBe(true);
  });

  it("rejeita mais de 60 parcelas", () => {
    const installments = Array.from({ length: 61 }, () => ({ amount: 10, dueDate: "2026-09-05" }));
    const result = createPlanSchema.safeParse({ ...BASE, installments });
    expect(result.success).toBe(false);
  });

  it("rejeita amount de parcela <= 0", () => {
    const result = createPlanSchema.safeParse({
      ...BASE,
      installments: [{ amount: 0, dueDate: "2026-09-05" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita total <= 0", () => {
    const result = createPlanSchema.safeParse({ ...BASE, total: 0 });
    expect(result.success).toBe(false);
  });

  it("aceita entryAmount 0 (sem entrada)", () => {
    const result = createPlanSchema.safeParse({ ...BASE, entryAmount: 0 });
    expect(result.success).toBe(true);
  });

  it("rejeita contractId vazio", () => {
    const result = createPlanSchema.safeParse({ ...BASE, contractId: "" });
    expect(result.success).toBe(false);
  });

  it("rejeita entryDueDate implausível (antes de 2020)", () => {
    const result = createPlanSchema.safeParse({ ...BASE, entryDueDate: "2010-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejeita dueDate de parcela implausível (mais de 15 anos no futuro)", () => {
    const result = createPlanSchema.safeParse({
      ...BASE,
      installments: [{ amount: 200, dueDate: "2100-01-01" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("createStandaloneSchema", () => {
  const BASE = {
    amount: 1500,
    description: "Consultoria avulsa pro Rick",
    dueDate: "2026-09-05",
  };

  it("aceita shape válido sem alreadyPaid (padrão: não recebido)", () => {
    expect(createStandaloneSchema.safeParse(BASE).success).toBe(true);
  });

  it("aceita alreadyPaid true/false", () => {
    expect(createStandaloneSchema.safeParse({ ...BASE, alreadyPaid: true }).success).toBe(true);
    expect(createStandaloneSchema.safeParse({ ...BASE, alreadyPaid: false }).success).toBe(true);
  });

  it("rejeita amount <= 0", () => {
    expect(createStandaloneSchema.safeParse({ ...BASE, amount: 0 }).success).toBe(false);
  });

  it("rejeita description vazia", () => {
    expect(createStandaloneSchema.safeParse({ ...BASE, description: "" }).success).toBe(false);
  });

  it("rejeita description acima de 200 chars", () => {
    expect(createStandaloneSchema.safeParse({ ...BASE, description: "a".repeat(201) }).success).toBe(false);
  });

  it("aceita description no limite de 200 chars", () => {
    expect(createStandaloneSchema.safeParse({ ...BASE, description: "a".repeat(200) }).success).toBe(true);
  });

  it("rejeita dueDate implausível (antes de 2020)", () => {
    expect(createStandaloneSchema.safeParse({ ...BASE, dueDate: "2010-01-01" }).success).toBe(false);
  });

  it("rejeita amount ausente", () => {
    const { amount: _amount, ...rest } = BASE;
    expect(createStandaloneSchema.safeParse(rest).success).toBe(false);
  });
});

describe("paySchema", () => {
  it("aceita body vazio (paidAt/paidNote opcionais)", () => {
    expect(paySchema.safeParse({}).success).toBe(true);
  });

  it("aceita paidAt e paidNote", () => {
    const result = paySchema.safeParse({ paidAt: "2026-08-01", paidNote: "pago via pix" });
    expect(result.success).toBe(true);
  });

  it("rejeita paidNote acima de 500 chars", () => {
    const result = paySchema.safeParse({ paidNote: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejeita paidAt no futuro -- pagamento já aconteceu, não pode ter data futura", () => {
    const umAnoNoFuturo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const result = paySchema.safeParse({ paidAt: umAnoNoFuturo });
    expect(result.success).toBe(false);
  });

  it("rejeita paidAt implausível (antes de 2020)", () => {
    const result = paySchema.safeParse({ paidAt: "2010-01-01" });
    expect(result.success).toBe(false);
  });
});

describe("updateReceivableSchema", () => {
  it("aceita patch vazio", () => {
    expect(updateReceivableSchema.safeParse({}).success).toBe(true);
  });

  it("aceita patch só com amount", () => {
    expect(updateReceivableSchema.safeParse({ amount: 500 }).success).toBe(true);
  });

  it("rejeita amount <= 0", () => {
    expect(updateReceivableSchema.safeParse({ amount: 0 }).success).toBe(false);
  });

  it("rejeita dueDate implausível (antes de 2020)", () => {
    expect(updateReceivableSchema.safeParse({ dueDate: "2010-01-01" }).success).toBe(false);
  });
});

describe("receivableQuerySchema", () => {
  it("aceita query vazia", () => {
    expect(receivableQuerySchema.safeParse({}).success).toBe(true);
  });

  it("aceita month no formato YYYY-MM", () => {
    expect(receivableQuerySchema.safeParse({ month: "2026-08" }).success).toBe(true);
  });

  it("rejeita month fora do formato YYYY-MM", () => {
    expect(receivableQuerySchema.safeParse({ month: "2026/08" }).success).toBe(false);
    expect(receivableQuerySchema.safeParse({ month: "26-08" }).success).toBe(false);
  });

  it("aceita contractId opcional", () => {
    expect(receivableQuerySchema.safeParse({ contractId: "contract-1" }).success).toBe(true);
  });
});

describe("receivableSeriesQuerySchema", () => {
  it("months omitido -> default 12", () => {
    const result = receivableSeriesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.months).toBe(12);
  });

  it("aceita os limites 1 e 24", () => {
    expect(receivableSeriesQuerySchema.safeParse({ months: "1" }).success).toBe(true);
    expect(receivableSeriesQuerySchema.safeParse({ months: "24" }).success).toBe(true);
  });

  it("rejeita 0 (abaixo do mínimo)", () => {
    expect(receivableSeriesQuerySchema.safeParse({ months: "0" }).success).toBe(false);
  });

  it("rejeita 25 (acima do máximo)", () => {
    expect(receivableSeriesQuerySchema.safeParse({ months: "25" }).success).toBe(false);
  });

  it("rejeita valor não-inteiro", () => {
    expect(receivableSeriesQuerySchema.safeParse({ months: "3.5" }).success).toBe(false);
  });

  it("rejeita valor não-numérico", () => {
    expect(receivableSeriesQuerySchema.safeParse({ months: "abc" }).success).toBe(false);
  });
});
