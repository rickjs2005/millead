import type { BriefingDetail, BriefingField } from "@/types/api";
import type { PromptInput } from "./build-prompt";

/**
 * Converte as RESPOSTAS de um briefing concluído em prefill do gerador de
 * prompt — o cliente já contou tudo no formulário; nada de redigitar.
 *
 * Mapeia por key de campo (templates do seed usam keys canônicas:
 * empresa/descricao/publico/diferenciais/...). Em template CUSTOM as keys
 * são slugs do label — a heurística por substring cobre os casos comuns e
 * TODO o resto vai pras "Observações adicionais" como "Label: valor",
 * então nenhuma resposta se perde.
 */

type Bucket =
  | "businessName"
  | "description"
  | "audience"
  | "differentials"
  | "references"
  | "city"
  | "state"
  | "whatsapp"
  | "phone"
  | "email"
  | "skip";

function bucketFor(key: string, type: BriefingField["type"]): Bucket | null {
  if (type === "FILE") return "skip"; // blob/url de arquivo não ajuda no prompt
  const k = key.toLowerCase();
  if (k === "empresa" || k.includes("nome_da_empresa") || k.includes("nome_empresa"))
    return "businessName";
  if (k.includes("descri") || k === "sobre" || k.includes("servico") || k.includes("produto"))
    return "description";
  if (k.includes("public")) return "audience";
  if (k.includes("diferenc")) return "differentials";
  if (k.includes("referencia") || k.includes("inspira")) return "references";
  if (k.includes("cidade")) return "city";
  if (k.includes("estado") || k === "uf") return "state";
  if (k.includes("whats")) return "whatsapp";
  if (k.includes("telefone") || k.includes("fone") || k.includes("celular")) return "phone";
  if (k.includes("mail")) return "email";
  return null; // vai pras observações
}

function answerValue(valueText: string | null, valueJson: unknown): string {
  if (valueText && valueText.trim()) return valueText.trim();
  if (Array.isArray(valueJson)) return valueJson.filter((v) => typeof v === "string").join(", ");
  return "";
}

export function briefingToPromptPrefill(detail: BriefingDetail): Partial<PromptInput> {
  // fieldId -> field (inclui filhos de GRUPO)
  const fields = new Map<string, BriefingField>();
  for (const section of detail.template.sections) {
    for (const field of section.fields) {
      fields.set(field.id, field);
      for (const child of field.children ?? []) fields.set(child.id, child);
    }
  }

  // key -> valores (respostas de grupo repetível geram várias linhas por campo)
  const byBucket = new Map<Bucket, string[]>();
  const extras: string[] = [];
  const push = (bucket: Bucket, v: string) => {
    const list = byBucket.get(bucket) ?? [];
    if (!list.includes(v)) list.push(v);
    byBucket.set(bucket, list);
  };

  for (const answer of detail.answers) {
    const field = fields.get(answer.fieldId);
    if (!field) continue;
    const value = answerValue(answer.valueText, answer.valueJson);
    if (!value) continue;
    const bucket = bucketFor(field.key, field.type);
    if (bucket === "skip") continue;
    if (bucket) push(bucket, value);
    else extras.push(`${field.label}: ${value}`);
  }

  const joined = (b: Bucket, sep = "\n") => byBucket.get(b)?.join(sep) ?? "";
  const location = [joined("city", ", "), joined("state", ", ")].filter(Boolean).join(" / ");
  const contact = [joined("whatsapp", " · "), joined("phone", " · "), joined("email", " · ")]
    .filter(Boolean)
    .join(" · ");

  const prefill: Partial<PromptInput> = {};
  if (joined("businessName")) prefill.businessName = joined("businessName", " ");
  if (joined("description")) prefill.description = joined("description");
  if (joined("audience")) prefill.audience = joined("audience", "; ");
  if (joined("differentials")) prefill.differentials = joined("differentials");
  if (joined("references")) prefill.references = joined("references", ", ");
  if (location) prefill.location = location;
  if (contact) prefill.contact = contact;
  if (extras.length) prefill.notes = `Do briefing do cliente:\n${extras.join("\n")}`;
  return prefill;
}
