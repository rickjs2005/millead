import { describe, expect, it } from "vitest";
import { PartyRegistryService } from "./party-registry-service.js";

const VAULT = "vault-1";

function makeFakes() {
  const contatos: Array<{ id: string; name: string }> = [];
  const fornecedores: Array<{ id: string; name: string; aliases: Array<{ alias: string }> }> = [];

  const debts = {
    listContacts: async () => contatos,
    createContact: async (_v: string, input: { name: string; notes: string | null }) => {
      const novo = { id: `p-${contatos.length + 1}`, name: input.name, notes: input.notes };
      contatos.push(novo);
      return novo;
    },
  };
  const catalog = {
    listMerchants: async () => fornecedores,
    createMerchant: async (_v: string, input: { name: string; aliases: string[] }) => {
      const novo = {
        id: `f-${fornecedores.length + 1}`,
        name: input.name,
        aliases: input.aliases.map((alias) => ({ alias })),
      };
      fornecedores.push(novo);
      return novo;
    },
  };

  // Os fakes implementam só os métodos que a porta usa -- é o ponto de ela ser
  // estreita.
  const service = new PartyRegistryService(catalog as never, debts as never);
  return { service, contatos, fornecedores };
}

describe("não duplicar quem já existe", () => {
  it("o mesmo nome duas vezes cria uma vez só", async () => {
    const f = makeFakes();
    const a = await f.service.ensurePerson(VAULT, "Samili Linda Morais Perigolo");
    const b = await f.service.ensurePerson(VAULT, "Samili Linda Morais Perigolo");

    expect(a).toEqual({ id: "p-1", created: true });
    expect(b).toEqual({ id: "p-1", created: false });
    expect(f.contatos).toHaveLength(1);
  });

  it.each([
    ["SAMILI LINDA MORAIS PERIGOLO", "caixa alta"],
    ["Samili  Linda  Morais  Perigolo", "espaço duplo"],
    ["Samili Linda Morais Perigolo.", "pontuação no fim"],
  ])("%s é a mesma pessoa (%s)", async (variacao) => {
    // O banco escreve o nome de um jeito em cada arquivo. Se cada grafia
    // virasse um contato, seis extratos dariam seis "Samili".
    const f = makeFakes();
    await f.service.ensurePerson(VAULT, "Samili Linda Morais Perigolo");
    const r = await f.service.ensurePerson(VAULT, variacao);

    expect(r.created).toBe(false);
    expect(f.contatos).toHaveLength(1);
  });

  it("acento não separa: José e JOSE são o mesmo", async () => {
    const f = makeFakes();
    await f.service.ensurePerson(VAULT, "José da Silva");
    await f.service.ensurePerson(VAULT, "JOSE DA SILVA");

    expect(f.contatos).toHaveLength(1);
  });

  it("nomes diferentes continuam diferentes", async () => {
    const f = makeFakes();
    await f.service.ensurePerson(VAULT, "Ana Souza");
    await f.service.ensurePerson(VAULT, "Ana Souza Lima");

    expect(f.contatos).toHaveLength(2);
  });
});

describe("pessoa e fornecedor são listas separadas", () => {
  it("o mesmo nome nos dois lados não colide", async () => {
    // "Silva" pode ser uma pessoa E um mercado. Uma chave só para os dois faria
    // o segundo cadastro sumir dentro do primeiro.
    const f = makeFakes();
    await f.service.ensurePerson(VAULT, "Silva");
    const fornecedor = await f.service.ensureMerchant(VAULT, "Silva");

    expect(fornecedor.created).toBe(true);
    expect(f.contatos).toHaveLength(1);
    expect(f.fornecedores).toHaveLength(1);
  });
});

describe("o fornecedor nasce pronto para a classificação", () => {
  it("ganha o nome normalizado como alias", async () => {
    // É por esse alias que a classificação reencontra o fornecedor nas próximas
    // importações, sem depender de o banco escrever o nome igual.
    const f = makeFakes();
    await f.service.ensureMerchant(VAULT, "Academia Total Fitness");

    expect(f.fornecedores[0]!.aliases).toEqual([{ alias: "ACADEMIA TOTAL FITNESS" }]);
  });

  it("um alias existente já basta para não duplicar", async () => {
    const f = makeFakes();
    await f.service.ensureMerchant(VAULT, "Academia Total Fitness");
    const r = await f.service.ensureMerchant(VAULT, "ACADEMIA TOTAL FITNESS");

    expect(r.created).toBe(false);
    expect(f.fornecedores).toHaveLength(1);
  });
});

describe("de onde veio", () => {
  it("o contato criado diz que foi a importação que o criou", async () => {
    // Meses depois, abrindo Pessoas, você precisa distinguir o que cadastrou à
    // mão do que o sistema cadastrou por você.
    const f = makeFakes();
    await f.service.ensurePerson(VAULT, "Maria");

    expect((f.contatos[0] as { notes?: string }).notes).toMatch(/importação de extrato/i);
  });
});
