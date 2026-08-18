/** Onde o preço escolhido cai em relação à faixa do catálogo. */
export type VeredictoFaixa = "dentro" | "abaixo" | "acima";

/**
 * Checagem de sanidade do preço: a faixa do produto é a referência de
 * mercado que já está cadastrada. Cobrar abaixo do piso é o erro caro e
 * silencioso -- é pra ele que este veredito existe.
 *
 * Devolve null quando não dá pra opinar: sem preço, sem produto ou com faixa
 * mal cadastrada (opinar com dado ruim é pior que ficar calado).
 */
export function compararComFaixa(
  preco: number | null | undefined,
  faixa: { priceMin: string; priceMax: string } | undefined,
): VeredictoFaixa | null {
  if (!preco || preco <= 0 || !faixa) return null;

  const min = Number(faixa.priceMin);
  const max = Number(faixa.priceMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return null;

  if (preco < min) return "abaixo";
  if (preco > max) return "acima";
  return "dentro";
}
