import type { BriefingDetail } from "@/types/api";

/**
 * Converte as respostas de um briefing em valores iniciais do formulário de
 * empresa — espelho CLIENT-SIDE do `briefing-company-extractor` da API (o
 * botão "Criar/Atualizar empresa" do detalhe do briefing usa o extrator do
 * servidor; aqui é o caminho inverso: o dono abre "Nova empresa" e puxa um
 * briefing pra não redigitar).
 *
 * Keys canônicas dos templates do seed + substring pra templates CUSTOM.
 */
export interface CompanyPrefill {
  name?: string;
  document?: string;
  segment?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

function answerValue(valueText: string | null, valueJson: unknown): string {
  if (valueText && valueText.trim()) return valueText.trim();
  if (Array.isArray(valueJson)) {
    return valueJson.filter((v): v is string => typeof v === "string").join(", ");
  }
  return "";
}

export function companyPrefillFromBriefing(detail: BriefingDetail): CompanyPrefill {
  const fieldsById = new Map<string, { key: string; type: string; sectionKey: string }>();
  for (const section of detail.template.sections) {
    for (const field of section.fields) {
      fieldsById.set(field.id, { key: field.key, type: field.type, sectionKey: section.key });
      for (const child of field.children ?? []) {
        fieldsById.set(child.id, { key: child.key, type: child.type, sectionKey: section.key });
      }
    }
  }

  let name: string | undefined;
  let fantasia: string | undefined;
  let document: string | undefined;
  let segment: string | undefined;
  let city: string | undefined;
  let state: string | undefined;
  let whatsapp: string | undefined;
  let phone: string | undefined;
  let email: string | undefined;
  const notes: string[] = [];

  for (const answer of detail.answers) {
    const field = fieldsById.get(answer.fieldId);
    if (!field || field.type === "FILE") continue;
    const value = answerValue(answer.valueText, answer.valueJson);
    if (!value) continue;
    const k = field.key.toLowerCase();

    if (
      (k === "nome" && field.sectionKey === "empresa") ||
      k === "empresa" ||
      k.includes("razao") ||
      k.includes("nome_da_empresa") ||
      k.includes("nome_empresa")
    ) {
      name ??= value;
    } else if (k.includes("fantasia")) {
      fantasia ??= value;
    } else if (k.includes("cnpj") || k.includes("cpf")) {
      const digits = value.replace(/\D/g, "");
      if (digits) document ??= digits;
    } else if (k.includes("segmento") || k.includes("nicho") || k.includes("ramo")) {
      segment ??= value;
    } else if (k.includes("cidade")) {
      city ??= value;
    } else if (k.includes("estado") || k === "uf") {
      state ??= value;
    } else if (k.includes("whats")) {
      whatsapp ??= value;
    } else if (k.includes("telefone") || k.includes("fone")) {
      phone ??= value;
    } else if (k.includes("mail")) {
      email ??= value;
    } else if (k.includes("descri") || k === "sobre" || k.includes("historia")) {
      notes.push(value);
    }
  }

  const out: CompanyPrefill = {};
  const resolvedName = name ?? fantasia;
  if (resolvedName) out.name = resolvedName;
  if (document) out.document = document;
  if (segment) out.segment = segment;
  if (city) out.city = city;
  // O campo UF do form tem maxLength 2 -- resposta multi ("MG, ES") não cabe;
  // usa só a primeira sigla e o resto fica visível nas observações do briefing.
  if (state) out.state = state.split(",")[0]?.trim().slice(0, 2).toUpperCase();
  const fone = detail.contactPhone?.trim() || whatsapp || phone;
  if (fone) out.phone = fone;
  const mail = detail.contactEmail?.trim() || email;
  if (mail) out.email = mail;
  if (notes.length) out.notes = notes.join("\n");
  return out;
}
