/**
 * Aritmética de dinheiro em centavos inteiros.
 *
 * O Prisma entrega `Decimal` como string, e a tentação é somar com
 * `Number(a) + Number(b)`. Em ponto flutuante `0.1 + 0.2` é `0.30000000000000004`
 * — e num módulo cuja regra número um é "não contar o mesmo gasto duas vezes",
 * um total que erra no último centavo é pior que um erro barulhento: ele passa
 * despercebido até alguém conferir na mão.
 *
 * Tudo aqui converte pra inteiro, opera, e volta pra string com duas casas.
 */

const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/** String de dinheiro -> centavos inteiros. Lança se não for dinheiro. */
export function parseMoney(value: string): number {
  const trimmed = value.trim();
  if (!MONEY_PATTERN.test(trimmed)) {
    // Três casas decimais chegam aqui de propósito: arredondar em silêncio
    // faria um total fechar por sorte e outro não, sem nada no log.
    throw new Error(`Valor monetário inválido: ${JSON.stringify(value)}`);
  }

  const negative = trimmed.startsWith("-");
  const [whole = "0", fraction = ""] = trimmed.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return negative ? -cents : cents;
}

/** Centavos inteiros -> string com duas casas (o formato que o Prisma aceita). */
export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const formatted = `${Math.trunc(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
  return negative ? `-${formatted}` : formatted;
}

export function addMoney(a: string, b: string): number {
  return parseMoney(a) + parseMoney(b);
}

export function subtractMoney(a: string, b: string): number {
  return parseMoney(a) - parseMoney(b);
}

export function sumMoney(values: readonly string[]): number {
  return values.reduce((total, value) => total + parseMoney(value), 0);
}

/** -1, 0 ou 1 — mesma convenção de `Array.prototype.sort`. */
export function compareMoney(a: string, b: string): number {
  return Math.sign(parseMoney(a) - parseMoney(b));
}

/**
 * Quanto por cento de um valor, em centavos, arredondado meio-pra-cima.
 *
 * Usado pelo percentual empresarial das regras: 100% de R$120 é R$120, e
 * 33,33% de R$100 é R$33,33. Arredondar aqui (e não deixar fração de centavo
 * correr solta) é o que mantém a soma pessoal + empresarial fechando no total.
 */
export function percentOfMoney(cents: number, percent: string): number {
  const parsed = Number(percent);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`Percentual inválido: ${JSON.stringify(percent)}`);
  }
  // Multiplica em centésimos de centavo antes de arredondar, pra 33,33% não
  // virar 33,32 por erro de ponto flutuante acumulado.
  return Math.round((cents * parsed) / 100);
}
