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

export function isMultiField(key: string, config: unknown): boolean {
  if (config && typeof config === "object" && (config as { multi?: boolean }).multi) return true;
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
