import { describe, expect, it } from "vitest";
import { costItemSchema } from "./estimate.dto.js";

describe("costItemSchema", () => {
  it("aceita item one-time com billingCycle MONTHLY", () => {
    const result = costItemSchema.safeParse({
      label: "Higgsfield (1000 créditos)",
      amount: 239,
      billingCycle: "MONTHLY",
      isOneTime: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejeita item one-time com billingCycle YEARLY -- combinação sem sentido (custo único não tem ciclo)", () => {
    const result = costItemSchema.safeParse({
      label: "Higgsfield (1000 créditos)",
      amount: 239,
      billingCycle: "YEARLY",
      isOneTime: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Custo único deve usar ciclo mensal.");
      expect(result.error.issues[0]?.path).toEqual(["billingCycle"]);
    }
  });

  it("item recorrente (isOneTime ausente) aceita YEARLY normalmente", () => {
    const result = costItemSchema.safeParse({
      label: "Domínio",
      amount: 40,
      billingCycle: "YEARLY",
    });
    expect(result.success).toBe(true);
  });

  it("item recorrente com isOneTime explicitamente false aceita YEARLY normalmente", () => {
    const result = costItemSchema.safeParse({
      label: "Domínio",
      amount: 40,
      billingCycle: "YEARLY",
      isOneTime: false,
    });
    expect(result.success).toBe(true);
  });
});
