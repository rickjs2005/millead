import type { ImportIdentity } from "./import-identity.js";
import { normalizeDescription } from "./transaction-text.js";

/**
 * A conta que este extrato descreve já está cadastrada?
 *
 * ## A regra que organiza tudo aqui
 *
 * **Nunca associar em silêncio a uma conta errada.** Um extrato no lugar
 * errado mistura o dinheiro de duas contas, e o erro não aparece na hora: só
 * meses depois, num saldo que não fecha e que ninguém consegue explicar.
 *
 * Por isso o casamento é conservador. Só há escolha automática quando a
 * evidência é forte e **única**: os quatro últimos dígitos batem com uma conta,
 * e apenas uma. Qualquer ambiguidade — duas contas com o mesmo final, nenhum
 * final no arquivo — vira pergunta na tela.
 *
 * ## A hierarquia da evidência
 *
 * 1. **Últimos 4 dígitos** — é a identidade da conta. Sozinho já decide,
 *    desde que só uma conta case.
 * 2. **Instituição** — desempata quando duas contas têm o mesmo final, e
 *    confirma quando os dígitos batem. Sozinha nunca decide: ter Nubank não
 *    diz em qual das suas contas Nubank o extrato entra.
 * 3. **Nada** — sugere criar, com os dados que o arquivo já trouxe
 *    preenchidos.
 */

export type MatchLevel =
  /** Uma conta, dígitos batendo. Preenche sozinho. */
  | "exata"
  /** Bateu, mas com ressalva (só instituição, ou tipo divergente). Pergunta. */
  | "provavel"
  /** Mais de uma candidata. Pergunta qual. */
  | "ambigua"
  /** Nenhuma. Sugere criar. */
  | "nenhuma";

export interface Candidato {
  id: string;
  name: string;
  institution: string | null;
  last4: string | null;
}

export interface OriginMatch {
  level: MatchLevel;
  kind: "account" | "card" | null;
  /** Preenchido só em `exata`. Nos outros casos a tela pergunta. */
  selectedId: string | null;
  /** Todas as candidatas plausíveis, para a tela oferecer. */
  candidates: Candidato[];
  /** Por que este foi o resultado — a tela mostra, em português. */
  reason: string;
}

export function matchOrigin(
  identity: ImportIdentity,
  accounts: readonly Candidato[],
  cards: readonly Candidato[],
): OriginMatch {
  // O arquivo diz se é conta ou cartão (CCACCTFROM). Sem essa declaração, não
  // dá pra saber onde procurar, e procurar nos dois arriscaria lançar uma
  // fatura como conta corrente.
  if (identity.kind === null) {
    return {
      level: "nenhuma",
      kind: null,
      selectedId: null,
      candidates: [],
      reason: "O arquivo não diz se é conta ou cartão. Escolha abaixo.",
    };
  }

  const universo = identity.kind === "card" ? cards : accounts;
  // "Nenhum conta" e "Nenhuma cartão" saem errado com um rótulo só. Conta é
  // feminino, cartão é masculino, e a mensagem aparece na tela — texto que não
  // concorda em português lê como sistema mal-acabado.
  const t =
    identity.kind === "card"
      ? { nome: "cartão", nenhum: "Nenhum cartão", artigo: "o", plural: "cartões" }
      : { nome: "conta", nenhum: "Nenhuma conta", artigo: "a", plural: "contas" };

  if (universo.length === 0) {
    return {
      level: "nenhuma",
      kind: identity.kind,
      selectedId: null,
      candidates: [],
      reason: `${t.nenhum} cadastrad${t.artigo} ainda.`,
    };
  }

  // 1. Últimos quatro dígitos.
  if (identity.last4) {
    const porDigitos = universo.filter((c) => c.last4 === identity.last4);

    if (porDigitos.length === 1) {
      return {
        level: "exata",
        kind: identity.kind,
        selectedId: porDigitos[0]!.id,
        candidates: porDigitos,
        reason: `Final ${identity.last4} bate com "${porDigitos[0]!.name}".`,
      };
    }

    if (porDigitos.length > 1) {
      // Mesmo final em mais de um cadastro: a instituição pode desempatar.
      const comInstituicao = porDigitos.filter((c) => mesmaInstituicao(c, identity));
      if (comInstituicao.length === 1) {
        return {
          level: "exata",
          kind: identity.kind,
          selectedId: comInstituicao[0]!.id,
          candidates: porDigitos,
          reason: `Final ${identity.last4} e instituição batem com "${comInstituicao[0]!.name}".`,
        };
      }
      return {
        level: "ambigua",
        kind: identity.kind,
        selectedId: null,
        candidates: porDigitos,
        reason: `Mais de ${t.artigo === "a" ? "uma" : "um"} ${t.nome} termina em ${identity.last4}. Escolha qual.`,
      };
    }
  }

  // 2. Instituição — nunca decide sozinha.
  const porInstituicao = universo.filter((c) => mesmaInstituicao(c, identity));
  if (porInstituicao.length > 0) {
    return {
      level: "provavel",
      kind: identity.kind,
      selectedId: null,
      candidates: porInstituicao,
      reason: identity.last4
        ? `${t.nenhum} termina em ${identity.last4}, mas a instituição bate. Confirme.`
        : "O arquivo não traz o número, mas a instituição bate. Confirme.",
    };
  }

  // 3. Nada bate.
  return {
    level: "nenhuma",
    kind: identity.kind,
    selectedId: null,
    candidates: [],
    reason: identity.institution
      ? `${t.nenhum} de ${identity.institution} cadastrad${t.artigo}.`
      : `${t.nenhum} corresponde a este extrato.`,
  };
}

/**
 * Instituição bate?
 *
 * Comparação por continência nos dois sentidos, porque os nomes vêm
 * diferentes: o arquivo manda "Banco Nu Pagamentos S.A." e o cadastro diz
 * "Nubank". Exigir igualdade exata faria nada casar nunca.
 */
function mesmaInstituicao(candidato: Candidato, identity: ImportIdentity): boolean {
  if (!candidato.institution || !identity.institution) return false;
  const a = normalizeDescription(candidato.institution);
  const b = normalizeDescription(identity.institution);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

/** O que preencher no formulário de criação, com o que o arquivo trouxe. */
export interface SuggestedOrigin {
  kind: "account" | "card";
  name: string;
  institution: string | null;
  last4: string | null;
  accountType: string | null;
  currency: string | null;
}

export function suggestOrigin(identity: ImportIdentity): SuggestedOrigin | null {
  if (identity.kind === null) return null;

  const instituicao = identity.institution;
  const final = identity.last4 ? `··${identity.last4}` : null;
  const base = identity.kind === "card" ? "Cartão" : "Conta";

  return {
    kind: identity.kind,
    // Um nome que a pessoa reconhece, montado só com o que veio no arquivo.
    name: [instituicao ?? base, final].filter(Boolean).join(" "),
    institution: instituicao,
    last4: identity.last4,
    accountType: identity.accountType,
    currency: identity.currency,
  };
}
