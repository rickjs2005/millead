import { describe, expect, it } from "vitest";
import { emptyIdentity, type ImportIdentity } from "./import-identity.js";
import { matchOrigin, suggestOrigin, type Candidato } from "./import-origin-match.js";

function identidade(over: Partial<ImportIdentity> = {}): ImportIdentity {
  return { ...emptyIdentity(), kind: "account", institution: "Nubank", last4: "5678", ...over };
}

const conta = (over: Partial<Candidato> = {}): Candidato => ({
  id: "acc-1",
  name: "Conta principal",
  institution: "Nubank",
  last4: "5678",
  ...over,
});

describe("casamento seguro", () => {
  it("final único bate e preenche sozinho", () => {
    const r = matchOrigin(identidade(), [conta()], []);
    expect(r.level).toBe("exata");
    expect(r.selectedId).toBe("acc-1");
    expect(r.reason).toContain("5678");
  });

  it("o final decide mesmo com instituição escrita diferente", () => {
    // O arquivo manda "Banco Nu Pagamentos S.A."; o cadastro diz "Nubank".
    const r = matchOrigin(
      identidade({ institution: "Banco Nu Pagamentos S.A." }),
      [conta({ institution: "Nubank" })],
      [],
    );
    expect(r.level).toBe("exata");
  });

  it("cartão procura entre cartões, nunca entre contas", () => {
    // Uma fatura lançada como conta corrente faria o pagamento dela virar uma
    // segunda despesa.
    const r = matchOrigin(
      identidade({ kind: "card", last4: "1111" }),
      [conta({ id: "acc-1", last4: "1111" })],
      [conta({ id: "card-1", last4: "1111", name: "Cartão Nubank" })],
    );
    expect(r.kind).toBe("card");
    expect(r.selectedId).toBe("card-1");
  });
});

describe("nunca associar em silêncio à conta errada", () => {
  it("dois cadastros com o mesmo final viram pergunta", () => {
    const r = matchOrigin(identidade(), [conta({ id: "a" }), conta({ id: "b" })], []);
    expect(r.level).toBe("ambigua");
    expect(r.selectedId).toBeNull();
    expect(r.candidates).toHaveLength(2);
  });

  it("mas a instituição desempata quando só uma bate", () => {
    const r = matchOrigin(
      identidade(),
      [conta({ id: "a", institution: "Nubank" }), conta({ id: "b", institution: "Itaú" })],
      [],
    );
    expect(r.level).toBe("exata");
    expect(r.selectedId).toBe("a");
  });

  it("instituição sozinha NÃO decide — só sugere", () => {
    // Ter conta no Nubank não diz em qual das suas contas Nubank o extrato entra.
    const r = matchOrigin(identidade({ last4: null }), [conta({ last4: "9999" })], []);
    expect(r.level).toBe("provavel");
    expect(r.selectedId).toBeNull();
    expect(r.candidates).toHaveLength(1);
  });

  it("final que não existe em nenhuma conta não cai na instituição sozinha", () => {
    const r = matchOrigin(identidade({ last4: "0000" }), [conta({ last4: "5678" })], []);
    expect(r.level).toBe("provavel");
    expect(r.selectedId).toBeNull();
    expect(r.reason).toContain("0000");
  });
});

describe("quando não há o que casar", () => {
  it("sem nada cadastrado, sugere criar", () => {
    const r = matchOrigin(identidade(), [], []);
    expect(r.level).toBe("nenhuma");
    expect(r.reason).toMatch(/Nenhuma conta cadastrada/i);
  });

  it("arquivo que não diz se é conta ou cartão vira pergunta", () => {
    const r = matchOrigin(identidade({ kind: null }), [conta()], []);
    expect(r.level).toBe("nenhuma");
    expect(r.kind).toBeNull();
    expect(r.reason).toMatch(/não diz se é conta ou cartão/i);
  });

  it("instituição diferente de tudo que existe", () => {
    const r = matchOrigin(
      identidade({ institution: "Banco X", last4: "0000" }),
      [conta({ institution: "Nubank", last4: "5678" })],
      [],
    );
    expect(r.level).toBe("nenhuma");
    expect(r.reason).toContain("Banco X");
  });
});

describe("sugestão de cadastro", () => {
  it("monta o formulário com o que o arquivo trouxe", () => {
    const s = suggestOrigin(identidade({ accountType: "CHECKING", currency: "BRL" }))!;
    expect(s).toEqual({
      kind: "account",
      name: "Nubank ··5678",
      institution: "Nubank",
      last4: "5678",
      accountType: "CHECKING",
      currency: "BRL",
    });
  });

  it("sem instituição, usa um nome genérico em vez de vazio", () => {
    const s = suggestOrigin(identidade({ institution: null, kind: "card" }))!;
    expect(s.name).toBe("Cartão ··5678");
  });

  it("sem saber se é conta ou cartão, não sugere nada", () => {
    expect(suggestOrigin(identidade({ kind: null }))).toBeNull();
  });
});
