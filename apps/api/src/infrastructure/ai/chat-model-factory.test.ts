import { describe, expect, it } from "vitest";
import { buildChatModel } from "./chat-model-factory.js";

const base = {
  AI_MODEL: "claude-opus-5",
  NVIDIA_MODEL: "nvidia/nemotron-3.5-lightning-30b-a3b",
  NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
};

describe("buildChatModel", () => {
  it("sem chave nenhuma, IA desligada", () => {
    expect(buildChatModel(base)).toBeNull();
  });

  it("só a chave da NVIDIA → nemotron", () => {
    expect(buildChatModel({ ...base, NVIDIA_API_KEY: "n" })?.label).toBe(
      "nvidia:nvidia/nemotron-3.5-lightning-30b-a3b",
    );
  });

  it("só a chave da Anthropic → claude", () => {
    expect(buildChatModel({ ...base, ANTHROPIC_API_KEY: "a" })?.label).toBe("anthropic:claude-opus-5");
  });

  it("as duas chaves: a NVIDIA (gratuita) ganha o desempate", () => {
    expect(buildChatModel({ ...base, NVIDIA_API_KEY: "n", ANTHROPIC_API_KEY: "a" })?.label).toMatch(
      /^nvidia:/,
    );
  });

  it("AI_PROVIDER explícito manda, mesmo com as duas chaves", () => {
    expect(
      buildChatModel({ ...base, AI_PROVIDER: "anthropic", NVIDIA_API_KEY: "n", ANTHROPIC_API_KEY: "a" })
        ?.label,
    ).toMatch(/^anthropic:/);
  });

  it("AI_PROVIDER sem a chave correspondente derruba o boot com mensagem clara", () => {
    expect(() => buildChatModel({ ...base, AI_PROVIDER: "nvidia", ANTHROPIC_API_KEY: "a" })).toThrow(
      /NVIDIA_API_KEY/,
    );
    expect(() => buildChatModel({ ...base, AI_PROVIDER: "anthropic", NVIDIA_API_KEY: "n" })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });
});
