/**
 * Leitor de OFX, cobrindo as duas versões que os bancos brasileiros exportam.
 *
 * - **OFX 1.x** é SGML: cabeçalho `CHAVE:VALOR`, e tags que **não fecham**
 *   (`<FITID>123` e pronto, o valor termina na próxima tag ou quebra de linha).
 * - **OFX 2.x** é XML de verdade, tudo fechado.
 *
 * Um parser XML só quebraria no 1.x, e é justamente o formato mais comum por
 * aqui. A abordagem é ler `<TAG>valor` parando na próxima `<` ou quebra de
 * linha — o que funciona nos dois, porque no XML o valor termina em `</TAG>`,
 * que começa com `<`.
 *
 * Nada aqui interpreta valor ou data: as strings saem cruas e quem converte é
 * `import-mapper`, com as mesmas funções que o CSV usa. Duas conversões
 * diferentes para o mesmo campo seriam duas chances de divergir.
 */

export interface OfxTransaction {
  fitid: string | null;
  /** Como veio: `20260805` ou `20260805120000[-3:BRT]`. */
  datePosted: string | null;
  /** Como veio, com sinal: `-120.00`. */
  amount: string | null;
  description: string;
  type: string | null;
}

export interface OfxDocument {
  currency: string | null;
  /** Identificação da conta declarada no arquivo — só para conferência. */
  accountId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  transactions: OfxTransaction[];
}

export function parseOfx(text: string): OfxDocument | null {
  if (!text.includes("<OFX")) return null;

  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];

  return {
    currency: tag(text, "CURDEF"),
    accountId: tag(text, "ACCTID"),
    periodStart: tag(text, "DTSTART"),
    periodEnd: tag(text, "DTEND"),
    transactions: blocks.map((block) => {
      const body = block[1]!;
      return {
        fitid: tag(body, "FITID"),
        datePosted: tag(body, "DTPOSTED"),
        amount: tag(body, "TRNAMT"),
        // MEMO é a descrição mais rica; NAME é o fallback de quem não manda MEMO.
        description: tag(body, "MEMO") ?? tag(body, "NAME") ?? "",
        type: tag(body, "TRNTYPE"),
      };
    }),
  };
}

/**
 * Valor de uma tag. Para no primeiro `<` (fechamento no XML, próxima tag no
 * SGML) ou na quebra de linha.
 */
function tag(source: string, name: string): string | null {
  const match = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(source);
  const value = match?.[1]?.trim();
  return value ? value : null;
}
