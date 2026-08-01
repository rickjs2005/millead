import type { BriefingDetail } from "@/types/api";

/**
 * Converte as respostas de um briefing em valores iniciais do formulário de
 * orçamento — o briefing já diz de quem é o projeto (empresa/lead) e o que
 * o cliente quer (objetivos/funcionalidades), então título, lead e escopo
 * não precisam ser redigitados.
 *
 * Mesma filosofia dos mapeadores de contrato e do diretor criativo: keys
 * canônicas dos templates do seed + substring pra templates CUSTOM. Horas,
 * custos e preço ficam de fora de propósito — isso é decisão do dono, não
 * resposta de cliente.
 */
export interface EstimatePrefill {
  title?: string;
  leadId?: string;
  scopeText?: string;
}

function answerValue(valueText: string | null, valueJson: unknown): string[] {
  if (valueText && valueText.trim()) return [valueText.trim()];
  if (Array.isArray(valueJson)) {
    return valueJson.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  }
  return [];
}

export function estimatePrefillFromBriefing(detail: BriefingDetail): EstimatePrefill {
  const fieldsById = new Map<string, { key: string; type: string; sectionKey: string }>();
  for (const section of detail.template.sections) {
    for (const field of section.fields) {
      fieldsById.set(field.id, { key: field.key, type: field.type, sectionKey: section.key });
      for (const child of field.children ?? []) {
        fieldsById.set(child.id, { key: child.key, type: child.type, sectionKey: section.key });
      }
    }
  }

  let empresa: string | undefined;
  let fantasia: string | undefined;
  const scopeLines: string[] = [];

  for (const answer of detail.answers) {
    const field = fieldsById.get(answer.fieldId);
    if (!field || field.type === "FILE") continue;
    const values = answerValue(answer.valueText, answer.valueJson);
    if (values.length === 0) continue;
    const k = field.key.toLowerCase();

    if (
      (k === "nome" && field.sectionKey === "empresa") ||
      k === "empresa" ||
      k.includes("razao") ||
      k.includes("nome_da_empresa") ||
      k.includes("nome_empresa")
    ) {
      empresa ??= values[0];
    } else if (k.includes("fantasia")) {
      fantasia ??= values[0];
    } else if (k.includes("objetivo") || k.includes("funcionalidade")) {
      // MULTI_SELECT vira uma linha de escopo por opção marcada.
      scopeLines.push(...values);
    }
  }

  const out: EstimatePrefill = {};
  const name = fantasia ?? empresa ?? detail.contactName?.trim();
  if (name) out.title = name;
  if (detail.leadId) out.leadId = detail.leadId;
  if (scopeLines.length) out.scopeText = [...new Set(scopeLines)].join("\n");
  return out;
}
