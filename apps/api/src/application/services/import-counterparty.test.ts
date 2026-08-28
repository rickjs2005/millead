import { describe, expect, it } from "vitest";
import { parseCounterparty } from "./import-counterparty.js";

/**
 * As linhas abaixo têm a forma exata do extrato do Nubank, com nomes e
 * documentos inventados. É esse formato que ensinou o parser: o nome é o
 * SEGUNDO segmento, e o documento diz se é gente ou empresa.
 */
describe("CPF é pessoa", () => {
  it("extrai o nome e reconhece a pessoa pelo CPF mascarado", () => {
    const r = parseCounterparty(
      "Transferência enviada pelo Pix - Samili Linda Morais Perigolo - •••.216.826-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 186131267-6",
    )!;
    expect(r.name).toBe("Samili Linda Morais Perigolo");
    expect(r.kind).toBe("person");
    expect(r.evidence).toBe("cpf");
  });

  it("funciona com CPF inteiro também", () => {
    const r = parseCounterparty("Transferência enviada pelo Pix - Ana Souza - 123.456.789-00")!;
    expect(r.kind).toBe("person");
  });

  it("o nome não leva o lixo bancário do fim junto", () => {
    // A versão anterior pegava o ÚLTIMO segmento e trazia
    // "IP (0260) Agência: 1 Conta: 186131267-6" como se fosse o nome.
    const r = parseCounterparty(
      "Transferência enviada pelo Pix - Cristiano Rosa Vieira - •••.204.607-•• - MERCADO PAGO IP LTDA. (0323) Agência: 1 Conta: 1483815436-0",
    )!;
    expect(r.name).toBe("Cristiano Rosa Vieira");
    expect(r.name).not.toMatch(/agencia|conta|\d/i);
  });
});

describe("CNPJ é empresa", () => {
  it.each([
    [
      "Transferência enviada pelo Pix - ANA GAMING BRASIL - 55.933.850/0001-34 - EFÍ S.A. - IP (0364) Agência: 1 Conta: 644558-6",
      // "ANA" nao e sigla conhecida -- e nome proprio, e vira "Ana".
      "Ana Gaming Brasil",
    ],
    [
      "Transferência enviada pelo Pix - ACADEMIA TOTAL FITNESS - 40.851.509/0002-43 - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 961651363-1",
      "Academia Total Fitness",
    ],
    [
      "Transferência enviada pelo Pix - ENERGISA MINAS RIO - DISTRIBUIDORA DE ENERGIA S.A. - 19.527.639/0001-58 - Banco Citibank S.A. (0745)",
      "Energisa Minas Rio",
    ],
  ])("%s → empresa", (descricao, nome) => {
    const r = parseCounterparty(descricao)!;
    expect(r.kind).toBe("company");
    expect(r.evidence).toBe("cnpj");
    expect(r.name).toBe(nome);
  });

  it("boleto é sempre pago a empresa, mesmo sem documento na linha", () => {
    const r = parseCounterparty(
      "Pagamento de boleto efetuado - REALIZE CREDITO, FINANCIAMENTO E INVESTI",
    )!;
    expect(r.kind).toBe("company");
    expect(r.evidence).toBe("boleto");
    // O "e" fica minusculo: e conjuncao, e isso e o que faz um nome parecer
    // nome em vez de grito.
    expect(r.name).toBe("Realize Credito, Financiamento e Investi");
  });
});

describe("sem documento, não adivinha", () => {
  it("extrai o nome mas não afirma o tipo", () => {
    // Sem CPF nem CNPJ não há prova de qual dos dois é. Cadastrar seria
    // adivinhar, e o custo do erro cai numa lista que a pessoa vai ter que
    // limpar depois.
    const r = parseCounterparty("Transferência enviada pelo Pix - JOAO SILVA")!;
    expect(r.name).toBe("Joao Silva");
    expect(r.kind).toBeNull();
    expect(r.evidence).toBeNull();
  });
});

describe("linhas que não têm contraparte", () => {
  it.each(["Recarga de celular", "Compra no débito - MERCADO BOM PRECO", "Rendimentos", "", "   "])(
    "%s não produz contraparte de transferência",
    (descricao) => {
      const r = parseCounterparty(descricao);
      // "Recarga" tem verbo mas não tem segundo segmento; "Compra no débito" não
      // tem verbo de contraparte. Os dois devolvem null em vez de inventar.
      if (r) expect(r.kind).toBeNull();
    },
  );

  it("descrição sem hífen nenhum não tem o que separar", () => {
    expect(parseCounterparty("PIX ENVIADO")).toBeNull();
  });
});

describe("distinção que importa", () => {
  it("pessoa e empresa saem tipos diferentes da MESMA estrutura de linha", () => {
    // É esta diferença que decide se o nome vai para Pessoas ou Fornecedores.
    const pessoa = parseCounterparty(
      "Transferência enviada pelo Pix - Maria Silva - •••.111.222-•• - NU PAGAMENTOS",
    )!;
    const empresa = parseCounterparty(
      "Transferência enviada pelo Pix - MERCADO SILVA - 11.222.333/0001-44 - NU PAGAMENTOS",
    )!;

    expect(pessoa.kind).toBe("person");
    expect(empresa.kind).toBe("company");
  });
});
