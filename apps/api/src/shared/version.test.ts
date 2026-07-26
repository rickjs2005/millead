import { describe, expect, it } from "vitest";
import { resolveCommit } from "./version.js";

describe("resolveCommit", () => {
  it("usa o SHA que o Render injeta, encurtado", () => {
    expect(resolveCommit({ RENDER_GIT_COMMIT: "6eec5df1234567890abcdef" })).toBe("6eec5df");
  });

  it("aceita GIT_COMMIT como alternativa pra outros ambientes", () => {
    expect(resolveCommit({ GIT_COMMIT: "abcdef1234567890" })).toBe("abcdef1");
  });

  it("prefere o do Render quando os dois existem", () => {
    expect(resolveCommit({ RENDER_GIT_COMMIT: "1111111aaa", GIT_COMMIT: "2222222bbb" })).toBe(
      "1111111",
    );
  });

  it("responde 'dev' quando nenhum está definido", () => {
    expect(resolveCommit({})).toBe("dev");
  });

  it("trata string vazia como ausente -- env var declarada e não preenchida é comum", () => {
    expect(resolveCommit({ RENDER_GIT_COMMIT: "", GIT_COMMIT: "   " })).toBe("dev");
  });

  it("devolve o SHA inteiro quando ele já é curto", () => {
    expect(resolveCommit({ GIT_COMMIT: "abc" })).toBe("abc");
  });
});
