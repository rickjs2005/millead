import { describe, expect, it } from "vitest";
import { describeAlert, formatVaultDate, todayInput, toVaultDateInput } from "./format.js";

describe("formatVaultDate", () => {
  it("mostra o dia do calendário, não o dia no fuso local", () => {
    // As datas do Cofre são `@db.Date` e chegam como meia-noite UTC. O
    // formatador genérico do app renderiza no fuso local, e em UTC-3 isso
    // mostraria 26 de agosto — todo lançamento apareceria um dia antes.
    expect(formatVaultDate("2026-08-27T00:00:00.000Z")).toContain("27");
    expect(formatVaultDate("2026-01-01T00:00:00.000Z")).toContain("1");
  });

  it("vira o ano sem deslizar", () => {
    expect(formatVaultDate("2027-01-01T00:00:00.000Z")).toContain("2027");
  });

  it("aceita ausência e lixo sem quebrar a tela", () => {
    expect(formatVaultDate(null)).toBe("—");
    expect(formatVaultDate(undefined)).toBe("—");
    expect(formatVaultDate("não é data")).toBe("—");
  });
});

describe("toVaultDateInput", () => {
  it("devolve AAAA-MM-DD, que é o que a API espera", () => {
    expect(toVaultDateInput("2026-08-27T00:00:00.000Z")).toBe("2026-08-27");
  });

  it("string vazia quando não há data", () => {
    expect(toVaultDateInput(null)).toBe("");
  });
});

describe("todayInput", () => {
  it("usa o dia local — é o dia que a pessoa está vendo no relógio dela", () => {
    expect(todayInput(new Date(2026, 7, 27, 23, 30))).toBe("2026-08-27");
    expect(todayInput(new Date(2026, 0, 5, 1, 0))).toBe("2026-01-05");
  });
});

describe("describeAlert", () => {
  it("monta a frase do exemplo do Claude", () => {
    expect(describeAlert("RENEWS_TOMORROW", { name: "Claude", expectedAmount: "120.00" })).toBe(
      "Claude renova amanhã — valor esperado R$ 120.00.",
    );
  });

  it("variação de preço mostra os dois valores", () => {
    expect(
      describeAlert("PRICE_CHANGED", {
        name: "Claude",
        expectedAmount: "120.00",
        chargedAmount: "150.00",
      }),
    ).toBe("Claude veio R$ 150.00 — esperado era R$ 120.00.");
  });

  it("duplicata nomeia as duas", () => {
    expect(describeAlert("POSSIBLE_DUPLICATE", { names: ["Claude", "Claude Pro"] })).toBe(
      "Claude e Claude Pro parecem ser a mesma assinatura.",
    );
  });

  it("sugestão diz quantas vezes se repetiu", () => {
    expect(
      describeAlert("POSSIBLE_NEW_SUBSCRIPTION", { description: "NETFLIX", occurrences: 3 }),
    ).toBe("NETFLIX se repete (3x) e ainda não é uma assinatura cadastrada.");
  });

  it("payload incompleto não quebra a frase", () => {
    // O payload vem do banco; um alerta antigo pode não ter todos os campos, e
    // a central de alertas não pode virar tela de erro por causa disso.
    expect(describeAlert("RENEWS_TODAY", {})).toBe("Assinatura renova hoje.");
    expect(describeAlert("PRICE_CHANGED", {})).toContain("?");
  });
});
