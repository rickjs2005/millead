import { describe, expect, it } from "vitest";
import { createUsageEntrySchema } from "./cost.dto.js";

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
