import { describe, expect, it } from "vitest";
import { transferredBytes } from "./http-site-auditor.js";

/**
 * O check de peso do HTML media o corpo já descomprimido contra um limite de
 * rede, e reprovava página que entrega dezenas de KB porque o fonte
 * descomprimido passava de 200KB. Estes testes fixam a diferença entre "o que
 * o visitante baixa" e "o que o navegador processa".
 */
describe("transferredBytes", () => {
  const headers = (h: Record<string, string>) => new Headers(h);
  // HTML repetitivo comprime muito, que é justamente o caso real: markup com
  // as mesmas classes e tags centenas de vezes.
  const html = "<div class='card'><p>conteudo repetido</p></div>".repeat(4000);
  const raw = Buffer.byteLength(html, "utf8");

  it("sem compressão, o que trafega é o próprio corpo", () => {
    expect(transferredBytes(html, raw, headers({}))).toBe(raw);
  });

  it("confia no content-length quando o servidor declara", () => {
    const h = headers({ "content-encoding": "br", "content-length": "12345" });
    expect(transferredBytes(html, raw, h)).toBe(12345);
  });

  it("estima por gzip quando comprime sem declarar tamanho (chunked)", () => {
    // O caso do Vercel: content-encoding: br + transfer-encoding: chunked.
    const h = headers({ "content-encoding": "br", "transfer-encoding": "chunked" });
    const estimado = transferredBytes(html, raw, h);
    expect(estimado).toBeLessThan(raw);
    expect(estimado).toBeGreaterThan(0);
  });

  it("página grande porém bem comprimida não é reprovada pelo limite de rede", () => {
    // Regressão: 322KB de fonte que viram ~44KB na rede passavam a reprovar.
    const h = headers({ "content-encoding": "br" });
    expect(raw).toBeGreaterThan(100 * 1024);
    expect(transferredBytes(html, raw, h)).toBeLessThan(100 * 1024);
  });

  it("ignora content-length inválido e cai na estimativa", () => {
    const h = headers({ "content-encoding": "gzip", "content-length": "0" });
    expect(transferredBytes(html, raw, h)).toBeGreaterThan(0);
  });
});
