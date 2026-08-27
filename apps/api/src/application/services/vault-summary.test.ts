import { describe, expect, it } from "vitest";
import { monthRange, summarizeMonth, type SummaryTransaction } from "./vault-summary.js";
import { parseMoney } from "./vault-money.js";

function mov(over: Partial<SummaryTransaction> = {}): SummaryTransaction {
  return {
    direction: "OUT",
    amountBrl: "100.00",
    status: "CONFIRMED",
    isTransfer: false,
    settlesDebtId: null,
    categoryId: "cat-1",
    splits: [],
    ...over,
  };
}

describe("a identidade que precisa fechar", () => {
  it("saídas = consumo pessoal + parte da empresa + reembolsável", () => {
    // O teste mais importante do módulo: se esta conta fecha ao centavo, nada
    // se perdeu no caminho e nada foi contado duas vezes.
    const r = summarizeMonth([
      mov({ amountBrl: "300.00", splits: [{ kind: "BUSINESS", amount: "100.00" }] }),
      mov({
        amountBrl: "250.00",
        splits: [
          { kind: "BUSINESS", amount: "50.00" },
          { kind: "REIMBURSABLE", amount: "75.00" },
        ],
      }),
      mov({ amountBrl: "40.00" }), // sem rateio: 100% pessoal
      mov({ direction: "IN", amountBrl: "5000.00" }),
      mov({ amountBrl: "900.00", isTransfer: true }),
      mov({ direction: "IN", amountBrl: "60.00", settlesDebtId: "debt-1" }),
      mov({ amountBrl: "999.00", status: "REVERSED" }),
    ]);

    const partes =
      parseMoney(r.consumoPessoal) + parseMoney(r.daEmpresa) + parseMoney(r.reembolsavel);
    expect(partes).toBe(parseMoney(r.saidas));
    expect(r.saidas).toBe("590.00"); // 300 + 250 + 40
    expect(r.consumoPessoal).toBe("365.00"); // 200 + 125 + 40
    expect(r.daEmpresa).toBe("150.00");
    expect(r.reembolsavel).toBe("75.00");
  });

  it("fecha com centavos ímpares, sem sobra de arredondamento", () => {
    const r = summarizeMonth([
      mov({ amountBrl: "33.33", splits: [{ kind: "BUSINESS", amount: "11.11" }] }),
      mov({ amountBrl: "0.01" }),
    ]);
    const partes =
      parseMoney(r.consumoPessoal) + parseMoney(r.daEmpresa) + parseMoney(r.reembolsavel);
    expect(partes).toBe(parseMoney(r.saidas));
    expect(r.consumoPessoal).toBe("22.23");
  });
});

describe("o que fica fora do fluxo", () => {
  it("transferência não é receita nem despesa — mas aparece", () => {
    const r = summarizeMonth([
      mov({ direction: "IN", amountBrl: "900.00", isTransfer: true }),
      mov({ amountBrl: "900.00", isTransfer: true }),
    ]);

    expect(r.entradas).toBe("0.00");
    expect(r.saidas).toBe("0.00");
    // Esconder faria a pessoa procurar dinheiro que "sumiu" da conta.
    expect(r.foraDoFluxo.transferencias).toEqual({ total: "1800.00", lancamentos: 2 });
  });

  it("o Pix que quita dívida não infla a renda do mês", () => {
    const r = summarizeMonth([
      mov({ direction: "IN", amountBrl: "5000.00" }),
      mov({ direction: "IN", amountBrl: "500.00", settlesDebtId: "debt-1" }),
    ]);

    // Contar os R$500 faria o mês parecer 10% melhor do que foi.
    expect(r.entradas).toBe("5000.00");
    expect(r.foraDoFluxo.baixasDivida).toEqual({ total: "500.00", lancamentos: 1 });
  });

  it("pagar dívida minha não vira despesa nova", () => {
    const r = summarizeMonth([mov({ amountBrl: "500.00", settlesDebtId: "debt-2" })]);
    expect(r.saidas).toBe("0.00");
    expect(r.consumoPessoal).toBe("0.00");
    expect(r.foraDoFluxo.baixasDivida.total).toBe("500.00");
  });

  it("estornada não conta em lugar nenhum, nem no total de lançamentos", () => {
    const r = summarizeMonth([mov({ amountBrl: "999.00", status: "REVERSED" }), mov()]);
    expect(r.saidas).toBe("100.00");
    expect(r.lancamentos).toBe(1);
  });
});

describe("resultado do mês", () => {
  it("é entradas menos saídas, e pode ser negativo", () => {
    const r = summarizeMonth([
      mov({ direction: "IN", amountBrl: "1000.00" }),
      mov({ amountBrl: "1500.00" }),
    ]);
    expect(r.resultado).toBe("-500.00");
  });

  it("usa o que SAIU da conta, não o consumo pessoal", () => {
    // A compra de R$300 com R$200 da empresa tirou R$300 do caixa. Usar o
    // consumo pessoal aqui diria que sobrou dinheiro que não sobrou.
    const r = summarizeMonth([
      mov({ direction: "IN", amountBrl: "300.00" }),
      mov({ amountBrl: "300.00", splits: [{ kind: "BUSINESS", amount: "200.00" }] }),
    ]);
    expect(r.resultado).toBe("0.00");
    expect(r.consumoPessoal).toBe("100.00");
  });
});

describe("por categoria", () => {
  it("agrupa consumo pessoal, do maior pro menor", () => {
    const r = summarizeMonth([
      mov({ categoryId: "cat-comida", amountBrl: "50.00" }),
      mov({ categoryId: "cat-moradia", amountBrl: "1200.00" }),
      mov({ categoryId: "cat-comida", amountBrl: "80.00" }),
    ]);

    expect(r.porCategoria).toEqual([
      { categoryId: "cat-moradia", total: "1200.00", lancamentos: 1 },
      { categoryId: "cat-comida", total: "130.00", lancamentos: 2 },
    ]);
  });

  it("conta só a parte pessoal, não o valor cheio", () => {
    const r = summarizeMonth([
      mov({
        categoryId: "cat-ia",
        amountBrl: "300.00",
        splits: [{ kind: "BUSINESS", amount: "250.00" }],
      }),
    ]);
    // Dizer R$300 aqui faria parecer que IA é seu maior gasto pessoal.
    expect(r.porCategoria[0]!.total).toBe("50.00");
  });

  it("sem categoria vira uma linha própria, em vez de sumir", () => {
    const r = summarizeMonth([mov({ categoryId: null, amountBrl: "70.00" })]);
    expect(r.porCategoria).toEqual([{ categoryId: null, total: "70.00", lancamentos: 1 }]);
  });
});

describe("monthRange", () => {
  it("cobre o mês inteiro em UTC", () => {
    const r = monthRange("2026-08")!;
    expect(r.from.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("acerta fevereiro bissexto", () => {
    expect(monthRange("2028-02")!.to.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(monthRange("2027-02")!.to.toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("recusa mês inválido em vez de devolver um intervalo torto", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("2026-00")).toBeNull();
    expect(monthRange("agosto")).toBeNull();
  });
});
