import type { SocialPlatform } from "@millead/database";
import type { BriefingDetail } from "../../domain/entities/briefing.js";

/**
 * Converte as RESPOSTAS de um briefing em dados de Empresa — o cliente já
 * informou cidade, CNPJ, redes sociais etc. no formulário; o cadastro não
 * deve ser redigitado. Mesma filosofia do prefill do gerador de prompt no
 * web: mapeia por key canônica dos templates do seed e cobre templates
 * CUSTOM por substring (as keys são slugs do label).
 */

export interface ExtractedCompanyData {
  name: string | null;
  document: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  websites: string[];
  socials: { platform: SocialPlatform; handleOrUrl: string }[];
}

function answerValue(valueText: string | null, valueJson: unknown): string {
  if (valueText && valueText.trim()) return valueText.trim();
  if (Array.isArray(valueJson)) {
    return valueJson.filter((v): v is string => typeof v === "string").join(", ");
  }
  return "";
}

const SOCIAL_KEYS: [needle: string, platform: SocialPlatform][] = [
  ["instagram", "INSTAGRAM"],
  ["facebook", "FACEBOOK"],
  ["linkedin", "LINKEDIN"],
  ["tiktok", "TIKTOK"],
];

export function extractCompanyData(detail: BriefingDetail): ExtractedCompanyData {
  const fieldsById = new Map<string, { key: string; label: string; type: string }>();
  for (const section of detail.template.sections) {
    for (const field of section.fields) {
      fieldsById.set(field.id, field);
      for (const child of field.children ?? []) fieldsById.set(child.id, child);
    }
  }

  const out: ExtractedCompanyData = {
    name: null,
    document: null,
    city: null,
    state: null,
    phone: null,
    email: null,
    notes: null,
    websites: [],
    socials: [],
  };
  const noteLines: string[] = [];

  for (const answer of detail.answers) {
    const field = fieldsById.get(answer.fieldId);
    if (!field || field.type === "FILE") continue;
    const value = answerValue(answer.valueText, answer.valueJson);
    if (!value) continue;
    const k = field.key.toLowerCase();

    const social = SOCIAL_KEYS.find(([needle]) => k.includes(needle));
    if (social) {
      out.socials.push({ platform: social[1], handleOrUrl: value });
      continue;
    }
    if (k === "empresa" || k.includes("nome_da_empresa") || k.includes("nome_empresa")) {
      out.name ??= value;
    } else if (k.includes("cnpj") || k.includes("cpf")) {
      const digits = value.replace(/\D/g, "");
      if (digits) out.document ??= digits;
    } else if (k.includes("cidade")) {
      out.city ??= value;
    } else if (k.includes("estado") || k === "uf") {
      out.state ??= value;
    } else if (k.includes("whats") || k.includes("telefone") || k.includes("fone")) {
      out.phone ??= value;
    } else if (k.includes("mail")) {
      out.email ??= value;
    } else if (k.includes("site") || k.includes("url") || k === "dominio") {
      // pode vir mais de um site (campo repetível)
      out.websites.push(value);
    } else if (k.includes("descri") || k === "sobre") {
      out.notes = out.notes ? `${out.notes}\n${value}` : value;
    } else {
      noteLines.push(`${field.label}: ${value}`);
    }
  }

  // Respostas sem campo próprio na Empresa viram anotação — nada se perde.
  if (noteLines.length) {
    const extra = `Do briefing do cliente:\n${noteLines.join("\n")}`;
    out.notes = out.notes ? `${out.notes}\n\n${extra}` : extra;
  }

  return out;
}
