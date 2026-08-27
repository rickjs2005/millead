import { lastDayOfMonth, utcDate } from "./vault-date.js";

/**
 * Leitura de data de extrato, sempre em UTC.
 *
 * `08/07/2026` é 8 de julho no Brasil e 7 de agosto nos EUA — a mesma string,
 * dois meses diferentes. Só o perfil do banco sabe qual é, então a ordem vem
 * de fora e nunca é inferida.
 *
 * A exceção é `AAAA-MM-DD` (e o `AAAAMMDD` do OFX): ano de quatro dígitos na
 * frente não é ambíguo, e esses formatos são lidos independentemente da ordem
 * configurada.
 *
 * Tudo constrói com `Date.UTC`. Ver `vault-date.ts` sobre por que o
 * construtor local faria a data andar um dia.
 */

export type DateOrder = "DMY" | "MDY" | "YMD";

export function parseImportedDate(raw: string, order: DateOrder): Date | null {
  const text = raw.trim();
  if (!text) return null;

  // AAAA-MM-DD / AAAA/MM/DD -- não ambíguo, ignora a ordem do perfil.
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // AAAAMMDD (OFX), possivelmente com hora e fuso colados atrás.
  const compact = /^(\d{4})(\d{2})(\d{2})/.exec(text);
  if (compact) return build(Number(compact[1]), Number(compact[2]), Number(compact[3]));

  const parts = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (!parts) return null;

  const [first, second, rawYear] = [Number(parts[1]), Number(parts[2]), parts[3]!];
  const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

  if (order === "YMD") return build(first, second, year); // formato incomum, mas honra o perfil
  return order === "DMY" ? build(year, second, first) : build(year, first, second);
}

/** Só devolve data que existe no calendário — 31/02 é erro, não 3 de março. */
function build(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > lastDayOfMonth(year, month)) return null;
  return utcDate(year, month, day);
}
