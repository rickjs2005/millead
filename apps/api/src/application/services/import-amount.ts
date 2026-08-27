/**
 * Leitura de valor monetário de extrato.
 *
 * Cada banco escreve dinheiro de um jeito: `1.234,56`, `1,234.56`, `-50,00`,
 * `50,00-`, `(50,00)`, `R$ 1.234,56`. O separador decimal vem do perfil do
 * banco, não de adivinhação — com vírgula decimal E ponto e vírgula como
 * separador de coluna, tentar inferir erra em silêncio.
 *
 * A regra que orienta tudo aqui: **na dúvida, recusar**. Uma linha rejeitada
 * aparece na revisão com o número da linha; um palpite errado vira um valor
 * torto no meio de centenas de linhas certas, e ninguém percebe.
 */

export interface ParsedAmount {
  /** Centavos, sempre positivo — o sinal fica em `negative`. */
  cents: number;
  negative: boolean;
}

export function parseImportedAmount(raw: string, decimalSeparator: "," | "."): ParsedAmount | null {
  let text = raw.trim();
  if (!text) return null;

  // Parênteses são notação contábil de negativo: (50,00).
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  // Sinal no fim é comum em exportação de mainframe: "50,00-".
  if (text.endsWith("-")) {
    negative = true;
    text = text.slice(0, -1).trim();
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1).trim();
  } else if (text.startsWith("+")) {
    text = text.slice(1).trim();
  }

  // Fora símbolo de moeda e espaço, inclusive o não-quebrável (U+00A0), que o
  // Excel usa como separador de milhar. Escrito como escape: literal, ele é
  // invisível no editor e o lint o rejeita com razão.
  text = text.replace(/[R$\s\u00a0]/gi, "");
  if (!text) return null;

  const thousandSeparator = decimalSeparator === "," ? "." : ",";

  // Mais de um separador decimal = ambíguo. "1,2,3" pode ser qualquer coisa, e
  // importar um palpite é pior que recusar a linha.
  if (text.split(decimalSeparator).length > 2) return null;

  const [whole = "", fraction] = text.split(decimalSeparator);
  const digits = whole.split(thousandSeparator).join("");

  if (!/^\d+$/.test(digits)) return null;
  if (fraction !== undefined && !/^\d{1,2}$/.test(fraction)) return null;

  const cents = Number(digits) * 100 + Number((fraction ?? "").padEnd(2, "0"));

  // Linha de valor zero não é movimentação -- costuma ser linha de saldo ou
  // separador que o banco enfia no meio do extrato.
  if (cents === 0) return null;

  return { cents, negative };
}
