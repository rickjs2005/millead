import type { BriefingDetail } from "@/types/api";
import type { CreateContractPayload } from "@/services/contracts";

/**
 * Converte as respostas de um briefing em valores iniciais do formulário de
 * contrato — o cliente já informou nome, CNPJ, e-mail, telefone e endereço
 * no briefing; o fechamento não deve redigitar nada disso.
 *
 * Mesma filosofia do `briefing-company-extractor` da API: mapeia por key
 * canônica dos templates do seed e cobre templates CUSTOM por substring
 * (as keys personalizadas são slugs do label). Campo sem resposta fica
 * de fora — o formulário mantém o default e o Rick completa na mão.
 */
export type ContractPrefill = Partial<
  Pick<
    CreateContractPayload,
    "tipoPessoa" | "nome" | "documento" | "email" | "telefone" | "endereco" | "nomeEmpresa"
  >
>;

function answerValue(valueText: string | null, valueJson: unknown): string {
  if (valueText && valueText.trim()) return valueText.trim();
  if (Array.isArray(valueJson)) {
    return valueJson.filter((v): v is string => typeof v === "string").join(", ");
  }
  return "";
}

export function contractPrefillFromBriefing(detail: BriefingDetail): ContractPrefill {
  const fieldsById = new Map<string, { key: string; type: string; sectionKey: string }>();
  for (const section of detail.template.sections) {
    for (const field of section.fields) {
      fieldsById.set(field.id, { key: field.key, type: field.type, sectionKey: section.key });
      for (const child of field.children ?? []) {
        fieldsById.set(child.id, { key: child.key, type: child.type, sectionKey: section.key });
      }
    }
  }

  let nomeEmpresa: string | undefined;
  let nomeFantasia: string | undefined;
  let documento: string | undefined;
  let email: string | undefined;
  let whatsapp: string | undefined;
  let telefone: string | undefined;
  let endereco: string | undefined;
  let cep: string | undefined;
  let cidade: string | undefined;
  let estado: string | undefined;

  for (const answer of detail.answers) {
    const field = fieldsById.get(answer.fieldId);
    if (!field || field.type === "FILE") continue;
    const value = answerValue(answer.valueText, answer.valueJson);
    if (!value) continue;
    const k = field.key.toLowerCase();

    // No template padrão a key do nome da empresa é só "nome" (seção
    // "empresa") — o contexto da seção desambigua do "nome" de um serviço.
    if (k === "nome" && field.sectionKey === "empresa") {
      nomeEmpresa ??= value;
    } else if (k.includes("razao") || k.includes("nome_da_empresa") || k.includes("nome_empresa")) {
      nomeEmpresa ??= value;
    } else if (k.includes("fantasia")) {
      nomeFantasia ??= value;
    } else if (k.includes("cnpj") || k.includes("cpf")) {
      const digits = value.replace(/\D/g, "");
      if ([11, 14].includes(digits.length)) documento ??= digits;
    } else if (k.includes("mail")) {
      email ??= value;
    } else if (k.includes("whats")) {
      whatsapp ??= value;
    } else if (k.includes("telefone") || k.includes("fone")) {
      telefone ??= value;
    } else if (k.includes("endereco") || k.includes("logradouro")) {
      endereco ??= value;
    } else if (k.includes("cep")) {
      cep ??= value;
    } else if (k.includes("cidade")) {
      cidade ??= value;
    } else if (k.includes("estado") || k === "uf") {
      estado ??= value;
    }
  }

  // Endereço do contrato é linha única; sem campo próprio no briefing,
  // compõe o que der (cidade - UF, CEP) e o resto se completa na mão.
  if (!endereco) {
    const cityLine = [cidade, estado].filter(Boolean).join(" - ");
    const parts = [cityLine, cep && `CEP ${cep}`].filter(Boolean);
    if (parts.length) endereco = parts.join(", ");
  }

  const out: ContractPrefill = {};
  const empresa = nomeEmpresa ?? nomeFantasia;
  if (empresa) out.nomeEmpresa = empresa;
  if (documento) {
    out.documento = documento;
    out.tipoPessoa = documento.length === 14 ? "PJ" : "PF";
  }
  // Contato do briefing (quem preencheu) é o responsável do contrato.
  const nome = detail.contactName?.trim();
  if (nome) out.nome = nome;
  const mail = detail.contactEmail?.trim() || email;
  if (mail) out.email = mail;
  const fone = detail.contactPhone?.trim() || whatsapp || telefone;
  if (fone) out.telefone = fone;
  if (endereco) out.endereco = endereco;
  return out;
}
