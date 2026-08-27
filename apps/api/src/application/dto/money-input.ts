import { z } from "zod";

/**
 * Dinheiro digitado por gente, normalizado para o formato que o resto do
 * módulo usa (`1234.56`).
 *
 * ## Por que isto existe
 *
 * A validação original aceitava só ponto. Num sistema inteiro em português,
 * com rótulo "Saldo hoje" e campo pequeno, a primeira coisa que a pessoa
 * digita é `8,06` — e recebia "Dados inválidos." sem dizer o que estava
 * inválido. Exigir a notação americana num formulário em pt-BR é transferir
 * pro usuário um trabalho que o código faz em três linhas.
 *
 * ## As regras
 *
 * - `8,06` → `8.06` — a vírgula é separador decimal.
 * - `1.234,56` → `1234.56` — com os dois, o **último** é o decimal e o outro é
 *   milhar. É o que distingue o formato brasileiro do americano sem precisar
 *   perguntar qual é.
 * - `1,234.56` → `1234.56` — pela mesma regra, na ordem inversa.
 * - `8.06` → `8.06` — continua valendo, porque era o formato aceito antes e
 *   quebrar quem já usava seria trocar um problema por outro.
 * - `R$ 1.234,56` → `1234.56` — o símbolo e os espaços saem; quem copia de um
 *   extrato cola com eles.
 *
 * O que **não** é aceito: negativo (a direção da movimentação carrega o sinal,
 * um valor negativo aqui significaria duas fontes de verdade para a mesma
 * coisa) e mais de duas casas decimais (todas as colunas de dinheiro do Cofre
 * são escala 2 — aceitar `8.061` seria arredondar em silêncio).
 */

const NORMALIZADO = /^\d+(\.\d{1,2})?$/;

export function normalizeMoneyInput(raw: string): string | null {
  // O \u00a0 do padrão abaixo é o espaço NÃO separável. Ele vem colado quando
  // se copia "R$ 1.234,56" de uma página de banco, e é invisível: sem tratá-lo
  // o valor seria recusado sem que a pessoa visse nada de errado no que
  // digitou. Escrito como escape, e não como o caractere em si, porque o lint
  // recusa espaço irregular no código -- com razão, já que ninguém enxerga.
  const limpo = raw.replace(/[\s\u00a0]/g, "").replace(/^R\$/i, "");
  if (limpo === "") return null;

  const temPonto = limpo.includes(".");
  const temVirgula = limpo.includes(",");

  let candidato: string;
  if (temPonto && temVirgula) {
    // O último separador é o decimal; o outro é milhar e some.
    const decimal = limpo.lastIndexOf(".") > limpo.lastIndexOf(",") ? "." : ",";
    const milhar = decimal === "." ? "," : ".";
    candidato = limpo.split(milhar).join("").replace(decimal, ".");
  } else if (temVirgula) {
    candidato = limpo.replace(",", ".");
  } else {
    candidato = limpo;
  }

  return NORMALIZADO.test(candidato) ? candidato : null;
}

/**
 * Valor monetário vindo de formulário.
 *
 * Devolve sempre a string normalizada, então tudo depois deste ponto —
 * `parseMoney`, os CHECKs do banco, os cálculos — continua vendo o mesmo
 * formato de sempre.
 */
export const moneyInput = z.string().transform((value, ctx) => {
  const normalizado = normalizeMoneyInput(value);
  if (normalizado === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      // A mensagem mostra os dois formatos porque os dois funcionam, e porque
      // dizer só "inválido" foi exatamente o que tornou o erro difícil de
      // entender da primeira vez.
      message: "Valor inválido. Escreva assim: 1234,56 (ou 1234.56).",
    });
    return z.NEVER;
  }
  return normalizado;
});

/** Idem, exigindo valor maior que zero. */
export function positiveMoneyInput(mensagem = "O valor precisa ser maior que zero.") {
  return moneyInput.refine((v) => Number(v) > 0, mensagem);
}
