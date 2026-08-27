/**
 * Transforma a lista de problemas do Zod numa frase que a pessoa entende.
 *
 * ## Por que existe
 *
 * A API responde `{ code: "VALIDATION_ERROR", message: "Dados invalidos.",
 * issues: [...] }`. O toast mostrava so a mensagem — e "Dados invalidos." num
 * formulario de seis campos nao diz nada: nao aponta o campo, nao diz o que
 * era esperado, e obriga a pessoa a adivinhar tentando um por vez.
 *
 * O detalhe sempre esteve na resposta, so nao chegava a tela. Isto pega a
 * mensagem especifica de cada problema, e todo formulario do app melhora junto
 * — sem precisar mexer em cada um deles.
 */

interface ZodIssueLike {
  message?: unknown;
}

/** Quantos problemas cabem num toast antes dele virar um paragrafo. */
const LIMITE = 2;

export function messageFromIssues(fallback: string, issues: unknown): string {
  if (!Array.isArray(issues)) return fallback;

  const mensagens = issues
    .map((issue) => (issue as ZodIssueLike)?.message)
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0);

  // Zod repete a mesma mensagem quando varios campos falham pela mesma regra
  // (tres valores no mesmo formato errado, por exemplo). Dizer tres vezes nao
  // acrescenta nada.
  const unicas = [...new Set(mensagens)];
  if (unicas.length === 0) return fallback;

  const mostradas = unicas.slice(0, LIMITE).join(" ");
  const resto = unicas.length - LIMITE;
  return resto > 0 ? `${mostradas} (e mais ${resto})` : mostradas;
}
