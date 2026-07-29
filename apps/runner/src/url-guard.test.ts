import { describe, expect, it } from "vitest";
import { assertPublicUrl } from "./url-guard.js";

describe("assertPublicUrl", () => {
  it("prefixa https quando falta protocolo", async () => {
    const url = await assertPublicUrl("milweb.com.br");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("milweb.com.br");
  });

  it("recusa protocolo que não é http(s)", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/protocolo/i);
  });

  it("recusa localhost", async () => {
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow(/interno/i);
  });

  it("recusa IP privado", async () => {
    await expect(assertPublicUrl("http://192.168.0.10")).rejects.toThrow(/interno/i);
  });

  it("recusa o metadata da nuvem", async () => {
    await expect(assertPublicUrl("http://169.254.169.254")).rejects.toThrow(/interno/i);
  });

  it("permite alvo interno quando allowPrivate está ligado", async () => {
    const url = await assertPublicUrl("http://127.0.0.1:4321/home.html", { allowPrivate: true });
    expect(url.port).toBe("4321");
  });
});
