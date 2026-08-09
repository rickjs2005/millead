import { describe, expect, it } from "vitest";
import { createUsageEntrySchema, updateFinanceSettingsSchema } from "./cost.dto.js";

describe("createUsageEntrySchema", () => {
  it("aceita o payload completo do front com note: null (campo vazio)", () => {
    const result = createUsageEntrySchema.safeParse({
      subscriptionId: "sub-1",
      companyId: null,
      credits: 10,
      usedAt: "2026-07-31",
      note: null,
    });
    expect(result.success).toBe(true);
  });

  it("aceita note como string", () => {
    const result = createUsageEntrySchema.safeParse({
      subscriptionId: "sub-1",
      companyId: null,
      credits: 10,
      usedAt: "2026-07-31",
      note: "Renderização de vídeo do cliente X",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita note com mais de 200 caracteres", () => {
    const result = createUsageEntrySchema.safeParse({
      subscriptionId: "sub-1",
      companyId: null,
      credits: 10,
      usedAt: "2026-07-31",
      note: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateFinanceSettingsSchema", () => {
  it("aceita usdRateAuto isolado (religar/desligar cotação automática)", () => {
    expect(updateFinanceSettingsSchema.safeParse({ usdRateAuto: true }).success).toBe(true);
    expect(updateFinanceSettingsSchema.safeParse({ usdRateAuto: false }).success).toBe(true);
  });

  it("aceita usdToBrlRate manual junto com usdRateAuto explícito", () => {
    const result = updateFinanceSettingsSchema.safeParse({ usdToBrlRate: 5.6, usdRateAuto: false });
    expect(result.success).toBe(true);
  });

  it("rejeita usdRateAuto não booleano", () => {
    const result = updateFinanceSettingsSchema.safeParse({ usdRateAuto: "sim" });
    expect(result.success).toBe(false);
  });

  it("payload vazio é válido (nenhum campo é obrigatório)", () => {
    expect(updateFinanceSettingsSchema.safeParse({}).success).toBe(true);
  });
});
