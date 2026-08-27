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
