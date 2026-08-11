import { describe, expect, it } from "vitest";
import { setFormatSchema } from "./social.dto.js";

describe("setFormatSchema", () => {
  it('aceita { format: "REDESIGN" }', () => {
    const result = setFormatSchema.safeParse({ format: "REDESIGN" });
    expect(result.success).toBe(true);
  });

  it("rejeita formato desconhecido", () => {
    const result = setFormatSchema.safeParse({ format: "X" });
    expect(result.success).toBe(false);
  });

  it("rejeita objeto vazio", () => {
    const result = setFormatSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
