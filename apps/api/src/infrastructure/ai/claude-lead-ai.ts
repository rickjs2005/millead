import Anthropic from "@anthropic-ai/sdk";
import type {
  LeadAi,
  LeadAiContext,
  LeadScoreResult,
  MessageDraftInput,
} from "../../domain/services/lead-ai.js";

const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "e-mail",
  SMS: "SMS",
};

/** Serializa o contexto num bloco legível pro modelo (pt-BR, sem JSON cru). */
function renderContext(ctx: LeadAiContext): string {
  const lines: string[] = [];
  lines.push(`## Lead: ${ctx.lead.title}`);
  lines.push(
    `Status: ${ctx.lead.status} | Estágio: ${ctx.lead.stageName ?? "sem estágio"} | Origem: ${ctx.lead.source}`,
  );
  if (ctx.lead.value) lines.push(`Valor estimado: ${ctx.lead.value} ${ctx.lead.currency}`);
  lines.push(`Criado em: ${ctx.lead.createdAt.toISOString().slice(0, 10)}`);
  if (ctx.lead.tags.length > 0) lines.push(`Etiquetas: ${ctx.lead.tags.join(", ")}`);
  if (ctx.lead.contacts.length > 0) {
    lines.push("Contatos:");
    for (const c of ctx.lead.contacts) {
      lines.push(`- ${c.name}${c.role ? ` (${c.role})` : ""}${c.email ? ` <${c.email}>` : ""}`);
    }
  }
  if (ctx.lead.recentNotes.length > 0) {
    lines.push("Observações recentes:");
    for (const note of ctx.lead.recentNotes) lines.push(`- ${note}`);
  }

  if (ctx.company) {
    lines.push("");
    lines.push(`## Empresa: ${ctx.company.name}`);
    if (ctx.company.segment) lines.push(`Segmento: ${ctx.company.segment}`);
    if (ctx.company.sizeEstimate) lines.push(`Porte: ${ctx.company.sizeEstimate}`);
    if (ctx.company.city || ctx.company.state) {
      lines.push(`Local: ${[ctx.company.city, ctx.company.state].filter(Boolean).join(", ")}`);
    }
    if (ctx.company.websites.length > 0) lines.push(`Sites: ${ctx.company.websites.join(", ")}`);
    if (ctx.company.socials.length > 0) {
      lines.push(
        `Redes: ${ctx.company.socials.map((s) => `${s.platform}: ${s.handleOrUrl}`).join(" | ")}`,
      );
    }
    if (ctx.company.notes) lines.push(`Notas sobre a empresa: ${ctx.company.notes}`);
  } else {
    lines.push("");
    lines.push("## Empresa: nenhuma vinculada ao lead");
  }

  if (ctx.audit) {
    lines.push("");
    lines.push("## Auditoria do site (mais recente)");
    if (ctx.audit.completedAt) {
      lines.push(`Concluída em: ${ctx.audit.completedAt.toISOString().slice(0, 10)}`);
    }
    if (ctx.audit.summary) lines.push(ctx.audit.summary);
    for (const s of ctx.audit.scores) lines.push(`- ${s.category}: ${s.score}/100`);
  } else {
    lines.push("");
    lines.push("## Auditoria do site: nenhuma realizada ainda");
  }

  if (ctx.recentActivities.length > 0) {
    lines.push("");
    lines.push("## Atividades recentes");
    for (const a of ctx.recentActivities) {
      lines.push(`- ${a.createdAt.toISOString().slice(0, 10)}: ${a.type}`);
    }
  }

  return lines.join("\n");
}

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: {
      type: "integer",
      description: "Nota de 0 a 100 da oportunidade de negócio deste lead.",
    },
    rationale: {
      type: "string",
      description:
        "Justificativa objetiva da nota em 2-4 frases, em português, citando os fatores decisivos.",
    },
  },
  required: ["score", "rationale"],
  additionalProperties: false,
} as const;

/**
 * Implementação da porta LeadAi sobre a API da Anthropic. A MilWead é uma
 * agência que vende sites/presença digital pra pequenos negócios -- os
 * prompts avaliam a oportunidade sob essa ótica.
 */
export class ClaudeLeadAi implements LeadAi {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async scoreLead(context: LeadAiContext): Promise<LeadScoreResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCORE_SCHEMA },
      },
      system:
        `Você avalia oportunidades de venda para a agência "${context.organizationName}", ` +
        "que vende criação de sites, presença digital e marketing para pequenos e médios negócios no Brasil. " +
        "Dê notas altas quando o prospect tem dinheiro pra investir e uma presença digital fraca que a agência pode melhorar " +
        "(site ruim ou inexistente, notas baixas de auditoria, segmento que depende de clientes locais). " +
        "Dê notas baixas quando há pouco sinal de oportunidade (site já excelente, lead frio, sem contatos, sem informações). " +
        "Seja criterioso: 50 é a média; reserve 80+ pra oportunidades realmente fortes.",
      messages: [
        {
          role: "user",
          content: `Avalie a oportunidade deste lead:\n\n${renderContext(context)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("A IA recusou a solicitação de score.");
    }
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const parsed = JSON.parse(text) as LeadScoreResult;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      rationale: parsed.rationale,
    };
  }

  async draftMessage(context: LeadAiContext, input: MessageDraftInput): Promise<string> {
    const channelLabel = CHANNEL_LABELS[input.channel] ?? input.channel;
    const parts = [
      `Escreva uma mensagem de prospecção por ${channelLabel} para o contato deste lead:`,
      "",
      renderContext(context),
    ];
    if (input.templateBody) {
      parts.push(
        "",
        "Use este modelo como ponto de partida (adapte com os dados do lead):",
        input.templateBody,
      );
    }
    if (input.instructions) {
      parts.push("", `Instruções adicionais do vendedor: ${input.instructions}`);
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system:
        `Você escreve mensagens de prospecção em nome da agência "${context.organizationName}" ` +
        "(criação de sites e presença digital para pequenos negócios no Brasil). " +
        "Regras: português do Brasil; tom humano e direto, sem parecer spam; personalize com dados reais do lead " +
        "(cite achados da auditoria do site quando existirem -- ex.: site lento, sem HTTPS); " +
        "no máximo 2 parágrafos curtos pra WhatsApp/SMS e 3 pra e-mail; termine com uma pergunta simples que convide resposta; " +
        "não invente fatos que não estão no contexto; não use placeholders como [NOME] -- se faltar o nome, escreva sem ele. " +
        "Responda SOMENTE com o texto da mensagem, sem preâmbulo nem explicações.",
      messages: [{ role: "user", content: parts.join("\n") }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("A IA recusou a geração da mensagem.");
    }
    return (response.content.find((b) => b.type === "text")?.text ?? "").trim();
  }

  async reportLead(context: LeadAiContext): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2500,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system:
        `Você é analista comercial da agência "${context.organizationName}" ` +
        "(sites e presença digital para pequenos negócios no Brasil). " +
        "Escreva um relatório executivo curto em português, em Markdown, com exatamente estas seções: " +
        "**Quem é** (1-2 frases sobre o prospect), " +
        "**Presença digital** (situação do site/redes com base na auditoria; se não houver auditoria, diga o que falta verificar), " +
        "**Oportunidade** (o que a agência pode vender e por quê), " +
        "**Próximo passo** (uma ação concreta e imediata pro vendedor). " +
        "Baseie-se apenas nos dados fornecidos; aponte lacunas em vez de inventar.",
      messages: [
        { role: "user", content: `Monte o relatório deste lead:\n\n${renderContext(context)}` },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("A IA recusou a geração do relatório.");
    }
    return (response.content.find((b) => b.type === "text")?.text ?? "").trim();
  }
}
