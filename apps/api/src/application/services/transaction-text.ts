/**
 * Tratamento do texto que vem do extrato.
 *
 * A normalização é conservadora de propósito: maiúsculas, sem acento, sem
 * espaço sobrando — e nada além disso. É tentador arrancar prefixos de
 * adquirente ("PAG*", "MP*"), números e sufixos, mas cada pedaço removido é um
 * sinal a menos pras regras do usuário: "ANTHROPIC" e "ANTHROPIC PRO" podem
 * merecer categorias diferentes, e uma limpeza agressiva transforma as duas na
 * mesma coisa sem aviso.
 *
 * Além disso, o texto normalizado entra no fingerprint de deduplicação. Toda
 * regra nova de limpeza muda a chave de TODA transação já importada sem FITID
 * — o que faria uma reimportação inteira parecer nova.
 */

/** Maiúsculas, sem acento, espaço colapsado. Idempotente. */
export function normalizeDescription(raw: string): string {
  return (
    raw
      .normalize("NFD")
      // Remove os diacríticos que o NFD separou das letras. Escrito como escape
      // (\u0300-\u036f) e não com os caracteres combinantes literais: literais
      // são invisíveis no editor e um "conserto" de formatação os apagaria sem
      // ninguém ver.
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/\s+/g, " ")
      .trim()
  );
}

export interface Installment {
  number: number;
  total: number;
}

/**
 * Lê "3/12", "PARC 3/12", "(3/12)" ou "PARCELA 3 DE 12".
 *
 * Devolve `null` quando não há parcela **ou quando a que há é incoerente**
 * (13/12, 0/12). Um palpite errado aqui vira parcela fantasma no relatório —
 * melhor não classificar e deixar a revisão manual decidir.
 */
export function extractInstallment(description: string): Installment | null {
  const text = normalizeDescription(description);

  const barra = /(?:^|[\s(])(\d{1,2})\s*\/\s*(\d{1,2})(?=[\s)]|$)/.exec(text);
  const porExtenso = /(\d{1,2})\s+DE\s+(\d{1,2})(?=\s|$)/.exec(text);
  const match = barra ?? porExtenso;
  if (!match) return null;

  const number = Number(match[1]);
  const total = Number(match[2]);

  // `\d{1,2}` já barra "08/2026" (competência, não parcela) porque o ano tem
  // quatro dígitos. Aqui sobra a coerência entre os dois números.
  if (number < 1 || total < 1 || number > total) return null;

  return { number, total };
}
