import { describe, expect, it } from "vitest";
import { messageFromIssues } from "./validation-message";

const GENERICA = "Dados inválidos.";

describe("mensagem de validação", () => {
  it("mostra o problema específico em vez da frase genérica", () => {
    // O caso real: campo "Saldo hoje" com 8,06 respondia só "Dados inválidos."
    const issues = [
      {
        path: ["reportedBalance"],
        message: "Valor inválido. Escreva assim: 1234,56 (ou 1234.56).",
      },
    ];
    expect(messageFromIssues(GENERICA, issues)).toContain("1234,56");
  });

  it("junta problemas diferentes", () => {
    const issues = [
      { path: ["name"], message: "Informe o nome." },
      { path: ["last4"], message: "Informe exatamente os 4 últimos dígitos." },
    ];
    const r = messageFromIssues(GENERICA, issues);
    expect(r).toContain("Informe o nome.");
    expect(r).toContain("4 últimos dígitos");
  });

  it("não repete a mesma mensagem quando vários campos falham igual", () => {
    const mesma = "Valor inválido. Escreva assim: 1234,56 (ou 1234.56).";
    const issues = [{ message: mesma }, { message: mesma }, { message: mesma }];
    expect(messageFromIssues(GENERICA, issues)).toBe(mesma);
  });

  it("resume quando são muitos, pra não virar um parágrafo no toast", () => {
    const issues = [{ message: "Um." }, { message: "Dois." }, { message: "Três." }];
    expect(messageFromIssues(GENERICA, issues)).toBe("Um. Dois. (e mais 1)");
  });

  it("cai na genérica quando não há issue aproveitável", () => {
    expect(messageFromIssues(GENERICA, undefined)).toBe(GENERICA);
    expect(messageFromIssues(GENERICA, [])).toBe(GENERICA);
    expect(messageFromIssues(GENERICA, "não é lista")).toBe(GENERICA);
    expect(messageFromIssues(GENERICA, [{ path: ["x"] }])).toBe(GENERICA);
    expect(messageFromIssues(GENERICA, [{ message: "   " }])).toBe(GENERICA);
  });
});
