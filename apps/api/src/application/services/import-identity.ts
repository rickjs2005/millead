/**
 * Quem é o dono do extrato — lido do próprio arquivo.
 *
 * É o que permite escolher o arquivo primeiro e a conta depois: o OFX já diz
 * qual banco e qual conta ele descreve, e obrigar a pessoa a repetir isso num
 * seletor antes de o sistema sequer olhar o arquivo era trabalho que o código
 * podia fazer.
 *
 * ## O que é lido, e o que cada campo resolve
 *
 * | Tag              | Para quê                                              |
 * | ---------------- | ----------------------------------------------------- |
 * | `ORG` / `FID`    | Nome e código da instituição — "Nubank", "Itaú"       |
 * | `BANKID`         | Código do banco (COMPE): 260 = Nubank, 341 = Itaú     |
 * | `ACCTID`         | Número da conta; dele saem os 4 últimos dígitos       |
 * | `ACCTTYPE`       | CHECKING / SAVINGS — vira o tipo da conta             |
 * | `CCACCTFROM`     | Presente = é fatura de CARTÃO, não conta corrente     |
 * | `CURDEF`         | Moeda do arquivo                                      |
 * | `DTSTART`/`DTEND`| Período do extrato                                    |
 * | `BALAMT`/`DTASOF`| Saldo informado e a data dele                         |
 *
 * ## Por que não adivinhar
 *
 * Tudo aqui sai do arquivo, sem inferência. Quando uma tag falta, o campo vem
 * `null` e a tela pergunta — associar um extrato à conta errada em silêncio
 * misturaria o dinheiro de duas contas, e o erro só apareceria meses depois,
 * num saldo que não fecha.
 */

export type ImportOriginKind = "account" | "card";

export interface ImportIdentity {
  /** `account` ou `card`. Vem de `CCACCTFROM` estar presente, não de palpite. */
  kind: ImportOriginKind | null;
  /** Nome da instituição como o arquivo declara (`ORG`). */
  institution: string | null;
  /** Código COMPE do banco (`BANKID`), quando houver. */
  bankId: string | null;
  /** Código da instituição no padrão OFX (`FID`). */
  fid: string | null;
  /** Número da conta ou do cartão, como veio. Nunca é gravado inteiro. */
  accountNumber: string | null;
  /** Os 4 últimos dígitos — é o único fragmento que o Cofre guarda. */
  last4: string | null;
  /** CHECKING / SAVINGS / etc., como o arquivo declara. */
  accountType: string | null;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** Saldo informado no arquivo (`BALAMT`), com sinal, como veio. */
  balance: string | null;
  balanceAt: string | null;
}

/**
 * Nomes conhecidos de instituição a partir do código COMPE.
 *
 * Só entra banco cujo `ORG` costuma vir feio ou ausente. A tabela é um atalho
 * de exibição, nunca um substituto do que o arquivo diz: se `ORG` existir, ele
 * ganha — é o próprio banco se nomeando.
 */
const BANCOS_POR_COMPE: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Banco Inter",
  "104": "Caixa Econômica Federal",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nubank",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "380": "PicPay",
  "422": "Banco Safra",
  "655": "Votorantim",
  "748": "Sicredi",
  "756": "Sicoob",
};

/**
 * Valor de uma tag OFX.
 *
 * Mesma estratégia do `import-ofx`: para no primeiro `<` (fechamento no XML,
 * próxima tag no SGML) ou na quebra de linha. É o que faz um leitor só
 * atender aos dois formatos.
 */
function tag(source: string, name: string): string | null {
  const match = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(source);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/** Bloco de uma tag composta, nos dois formatos. */
function block(source: string, name: string): string | null {
  const fechado = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i").exec(source);
  if (fechado?.[1]) return fechado[1];

  // SGML: a tag composta também não fecha. O bloco vai até a próxima tag de
  // mesmo nível, e o que interessa (as filhas) está logo abaixo.
  const aberto = new RegExp(`<${name}>([\\s\\S]{0,400})`, "i").exec(source);
  return aberto?.[1] ?? null;
}

/**
 * Últimos quatro dígitos de um número de conta.
 *
 * Ignora tudo que não é dígito porque o `ACCTID` vem de todo jeito: `1234-5`,
 * `0001 1234567`, `**** 1234`. Devolve `null` com menos de quatro — meio
 * identificador não identifica nada, e mostrar "··12" na tela seria pior que
 * não mostrar.
 */
export function last4Of(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  const digitos = accountNumber.replace(/\D/g, "");
  return digitos.length >= 4 ? digitos.slice(-4) : null;
}

export function identityFromOfx(text: string): ImportIdentity {
  const cartao = block(text, "CCACCTFROM");
  const conta = block(text, "BANKACCTFROM");
  const origem = cartao ?? conta;

  const bankId = origem ? tag(origem, "BANKID") : null;
  const org = tag(text, "ORG");
  const accountNumber = origem ? tag(origem, "ACCTID") : tag(text, "ACCTID");

  // Saldo: `LEDGERBAL` é o saldo do extrato; `AVAILBAL` é o disponível, que
  // desconta limite e não descreve o que aconteceu no período.
  const saldo = block(text, "LEDGERBAL");

  return {
    // A presença de CCACCTFROM é a declaração do próprio arquivo de que é
    // fatura de cartão. Sem nenhuma das duas, fica nulo e a tela pergunta.
    kind: cartao ? "card" : conta ? "account" : null,
    institution: org ?? (bankId ? (BANCOS_POR_COMPE[bankId] ?? null) : null),
    bankId,
    fid: tag(text, "FID"),
    accountNumber,
    last4: last4Of(accountNumber),
    accountType: origem ? tag(origem, "ACCTTYPE") : null,
    currency: tag(text, "CURDEF"),
    periodStart: tag(text, "DTSTART"),
    periodEnd: tag(text, "DTEND"),
    balance: saldo ? tag(saldo, "BALAMT") : null,
    balanceAt: saldo ? tag(saldo, "DTASOF") : null,
  };
}

/**
 * Tipo de conta do Cofre a partir do `ACCTTYPE` do arquivo.
 *
 * `MONEYMRKT` e `CREDITLINE` existem no padrão OFX e não têm equivalente aqui;
 * viram `null` pra tela perguntar, em vez de cair em "conta corrente" por
 * omissão e criar uma conta do tipo errado.
 */
export function accountTypeFromOfx(accountType: string | null): string | null {
  switch (accountType?.toUpperCase()) {
    case "CHECKING":
      return "CHECKING";
    case "SAVINGS":
      return "SAVINGS";
    default:
      return null;
  }
}

/** Identidade vazia — o que o CSV devolve, já que ele não se descreve. */
export function emptyIdentity(): ImportIdentity {
  return {
    kind: null,
    institution: null,
    bankId: null,
    fid: null,
    accountNumber: null,
    last4: null,
    accountType: null,
    currency: null,
    periodStart: null,
    periodEnd: null,
    balance: null,
    balanceAt: null,
  };
}
