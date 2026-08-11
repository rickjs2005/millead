import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html-escape.js";

describe("escapeHtml", () => {
  it("escapa & < > \" '", () => {
    expect(escapeHtml(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  it("escapa & antes dos demais -- não escapa em dobro", () => {
    // Se & fosse escapado depois de outro char, "&lt;" viraria "&amp;lt;".
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("neutraliza uma tentativa de injeção de markup/link (phishing)", () => {
    const malicioso = `<a href="http://phishing.example">clique aqui</a>`;
    const escaped = escapeHtml(malicioso);
    expect(escaped).not.toContain("<a ");
    expect(escaped).toBe("&lt;a href=&quot;http://phishing.example&quot;&gt;clique aqui&lt;/a&gt;");
  });

  it("texto normal sem caracteres especiais passa intacto", () => {
    expect(escapeHtml("Muito caro pro nosso orçamento")).toBe("Muito caro pro nosso orçamento");
  });

  it("string vazia devolve string vazia", () => {
    expect(escapeHtml("")).toBe("");
  });
});
