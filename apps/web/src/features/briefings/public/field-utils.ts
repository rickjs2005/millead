/** Máscaras e helpers pra facilitar o preenchimento do briefing pelo cliente. */

/** Formata um telefone/WhatsApp brasileiro conforme digita: (XX) XXXXX-XXXX. */
export function maskPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** CEP: 00000-000. */
export function maskCEP(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** CNPJ: 00.000.000/0000-00. */
export function maskCNPJ(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 14);
  let out = d.slice(0, 2);
  if (d.length > 2) out += `.${d.slice(2, 5)}`;
  if (d.length > 5) out += `.${d.slice(5, 8)}`;
  if (d.length > 8) out += `/${d.slice(8, 12)}`;
  if (d.length > 12) out += `-${d.slice(12)}`;
  return out;
}

/**
 * Escolhe a máscara de um campo TEXT: por `config.mask` ("cep"|"cnpj"|
 * "phone") ou por heurística da key. Retorna a função de máscara ou null.
 *
 * `allowKeyHeuristic` liga a adivinhação pelo NOME do campo -- válida só em
 * templates do seed, onde as keys são controladas. Em briefing personalizado
 * a key vem do slug do label que o admin digitou, então adivinhar máscara
 * pelo nome ("CNPJ do fornecedor", "Telefone") apagaria a entrada do cliente:
 * lá só vale `config.mask` explícito.
 */
export function pickMask(
  key: string,
  config: unknown,
  allowKeyHeuristic = true,
): ((v: string) => string) | null {
  const cfgMask =
    config && typeof config === "object" ? (config as { mask?: string }).mask : undefined;
  if (cfgMask === "cep") return maskCEP;
  if (cfgMask === "cnpj") return maskCNPJ;
  if (cfgMask === "phone") return maskPhoneBR;
  if (!allowKeyHeuristic) return null;
  const k = key.toLowerCase();
  if (k.includes("cep")) return maskCEP;
  if (k.includes("cnpj")) return maskCNPJ;
  if (k.includes("telefone") || k.includes("whatsapp") || k.includes("fone")) return maskPhoneBR;
  return null;
}

/** Completa https:// quando o cliente digita só o domínio (usado no onBlur de URL). */
export function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/**
 * Campos que costumam ter mais de um valor (o negócio atende várias cidades/
 * estados, ex.: Kavita Drones). Renderizados como "adicionar vários" (chips).
 * Combina com config.multi do template pra novos campos.
 */
const MULTI_KEYS = new Set(["cidade", "estado", "cidades", "estados"]);

export function isMultiField(key: string, config: unknown, allowKeyHeuristic = true): boolean {
  if (config && typeof config === "object" && (config as { multi?: boolean }).multi) return true;
  if (!allowKeyHeuristic) return false;
  return MULTI_KEYS.has(key.toLowerCase());
}

/** Valor multi é guardado como string separada por vírgula (cabe em valueText). */
export function parseTags(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
export function joinTags(tags: string[]): string {
  return tags.join(", ");
}
