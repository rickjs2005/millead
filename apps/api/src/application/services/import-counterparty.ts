import { normalizeDescription } from "./transaction-text.js";
import { titleCase } from "./merchant-display.js";

/**
 * Quem está do outro lado da movimentação — lido da linha do extrato.
 *
 * ## O que o Nubank escreve
 *
 * ```
 * Transferência enviada pelo Pix - Samili Linda Morais Perigolo - •••.216.826-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 186131267-6
 * Transferência enviada pelo Pix - ANA GAMING BRASIL - 55.933.850/0001-34 - EFÍ S.A. - IP (0364) Agência: 1 Conta: 644558-6
 * Pagamento de boleto efetuado - REALIZE CREDITO, FINANCIAMENTO E INVESTI
 * ```
 *
 * Duas coisas estão ali, de graça, e mudam tudo:
 *
 * 1. **O nome é o SEGUNDO segmento**, não o último. A primeira versão pegava
 *    o último e trazia "IP (0260) Agência: 1 Conta: 186131267-6" como se fosse
 *    o nome de alguém.
 * 2. **O documento diz se é gente ou empresa.** CPF (`•••.216.826-••`) é
 *    pessoa; CNPJ (`55.933.850/0001-34`) é empresa. Não é heurística sobre o
 *    formato do nome — é a declaração do próprio sistema bancário.
 *
 * Essa distinção é o que permite automatizar sem errar: pessoa vira contato em
 * **Pessoas** (e pode virar dívida); empresa vira **Fornecedor** (e pode virar
 * assinatura). Confundir os dois encheria o catálogo de fornecedores com nomes
 * de gente, e a lista de pessoas com nome de supermercado.
 *
 * ## Quando não há documento
 *
 * Bancos que não trazem CPF/CNPJ (`PIX RECEBIDO JOAO SILVA`) devolvem
 * `kind: null`. O nome ainda é extraído e mostrado, mas **nada é cadastrado
 * sozinho** — sem prova de qual dos dois é, criar seria adivinhar, e o custo
 * do erro recai sobre listas que a pessoa vai ter que limpar depois.
 */

export type PartyKind = "person" | "company";

export interface Counterparty {
  /** Nome legível, em caixa de título. */
  name: string;
  /** `person` (CPF), `company` (CNPJ) ou `null` quando o extrato não diz. */
  kind: PartyKind | null;
  /** O que provou o tipo — a tela mostra, e é o que torna a decisão auditável. */
  evidence: "cpf" | "cnpj" | "boleto" | null;
}

/**
 * CPF, inclusive mascarado.
 *
 * O Nubank publica `•••.216.826-••`: os dígitos do meio à mostra, as pontas
 * escondidas. O padrão aceita as duas formas porque o que importa aqui é o
 * FORMATO (três grupos e um dígito verificador separado por hífen), não o
 * número — que aliás nunca é guardado.
 */
const CPF = /(?:\d{3}|[•*.]{3})\.?\d{3}\.\d{3}-(?:\d{2}|[•*]{2})/;

/** CNPJ: `55.933.850/0001-34`. A barra é o que o distingue do CPF. */
const CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

/** Verbos que indicam que há uma contraparte nomeada logo adiante. */
const COM_CONTRAPARTE = /\b(PIX|TED|DOC|TRANSFERENCIA|TRANSF|BOLETO|PAGAMENTO|DEPOSITO|RECARGA)\b/;

/** Segmentos que são do banco, nunca da contraparte. */
const LIXO_BANCARIO = /\b(AGENCIA|CONTA|IP |S\.?A\.?$|LTDA\.?$|PAGAMENTOS|INSTITUICAO|BANCO|BCO)\b/;

export function parseCounterparty(description: string): Counterparty | null {
  const original = description.trim();
  if (!original) return null;

  const normalizada = normalizeDescription(original);
  if (!COM_CONTRAPARTE.test(normalizada)) return null;

  // Os segmentos vêm do texto ORIGINAL: o nome é para ser mostrado como a
  // pessoa se chama, e a normalização o deixaria em caixa alta sem acento.
  const partes = original
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length < 2) return null;

  // O documento pode estar em qualquer segmento; o tipo vem dele.
  const kind = detectKind(original);

  // O nome é o primeiro segmento DEPOIS do verbo que não seja documento nem
  // dado bancário. Normalmente é o segundo — mas procurar em vez de fixar a
  // posição atravessa as variações de cada banco.
  const nome = partes
    .slice(1)
    .find((parte) => !ehDocumento(parte) && !LIXO_BANCARIO.test(normalizeDescription(parte)));
  if (!nome) return null;

  const limpo = limparNome(nome);
  if (limpo.length < 3) return null;

  return {
    name: titleCase(normalizeDescription(limpo)),
    kind,
    evidence:
      kind === "person"
        ? "cpf"
        : CNPJ.test(original)
          ? "cnpj"
          : kind === "company"
            ? "boleto"
            : null,
  };
}

function detectKind(texto: string): PartyKind | null {
  if (CNPJ.test(texto)) return "company";
  if (CPF.test(texto)) return "person";
  // Boleto é sempre pago a uma empresa — não existe boleto de pessoa física
  // emitido direto. É evidência mais fraca que o documento, e por isso vem
  // depois dele.
  if (/\bBOLETO\b/.test(normalizeDescription(texto))) return "company";
  return null;
}

function ehDocumento(parte: string): boolean {
  return CPF.test(parte) || CNPJ.test(parte);
}

/**
 * Tira o que sobra colado ao nome.
 *
 * Códigos entre parênteses, números de agência e conta, e a pontuação de
 * sobra. O nome próprio em si nunca é alterado — quem lê precisa reconhecer
 * quem é.
 */
function limparNome(nome: string): string {
  return nome
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(AG[EÊ]NCIA|CONTA)\b[:\s]*[\d-]+/gi, " ")
    .replace(/[,;]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
