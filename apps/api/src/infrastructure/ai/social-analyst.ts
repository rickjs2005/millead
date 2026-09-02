import type { ChatModel } from "../../domain/services/chat-model.js";
import type {
  PostSummaryForAnalysis,
  SocialAnalysis,
  SocialAnalyst,
} from "../../domain/services/social-analyst.js";
import type { SocialPostFormat } from "../../domain/entities/social.js";

const FORMATS: SocialPostFormat[] = [
  "REDESIGN",
  "BEFORE_AFTER",
  "TIMELAPSE",
  "REVIEW",
  "ANIMATION",
  "CODE_SETUP",
  "OTHER",
];

/** Labels pt-BR das metricas nao-nulas, na ordem em que aparecem no bloco por post. */
function renderMetrics(post: PostSummaryForAnalysis): string[] {
  const metrics: string[] = [];
  if (post.reach !== null) metrics.push(`Alcance: ${post.reach}`);
  if (post.views !== null) metrics.push(`Visualizações: ${post.views}`);
  if (post.avgWatchTimeMs !== null) {
    metrics.push(`Retenção média: ${Math.round(post.avgWatchTimeMs / 1000)}s`);
  }
  if (post.likes !== null) metrics.push(`Curtidas: ${post.likes}`);
  if (post.comments !== null) metrics.push(`Comentários: ${post.comments}`);
  if (post.saved !== null) metrics.push(`Salvamentos: ${post.saved}`);
  if (post.shares !== null) metrics.push(`Compartilhamentos: ${post.shares}`);
  if (post.profileVisits !== null) metrics.push(`Visitas ao perfil: ${post.profileVisits}`);
  if (post.profileActivity !== null) {
    metrics.push(`Atividade no perfil: ${post.profileActivity}`);
  }
  return metrics;
}

/** Serializa um post num bloco legível pro modelo (pt-BR, sem JSON cru). */
function renderPost(post: PostSummaryForAnalysis, index: number): string {
  const lines: string[] = [];
  const date = post.publishedAt.toISOString().slice(0, 10);
  lines.push(`### Post ${index + 1} (${date})`);
  lines.push(`Formato: ${post.format} | Tipo de mídia: ${post.mediaType}`);

  const metrics = renderMetrics(post);
  if (metrics.length > 0) lines.push(`Métricas: ${metrics.join(", ")}`);

  if (post.caption) {
    const firstLine = post.caption.split("\n")[0];
    lines.push(`Legenda: ${firstLine}`);
  }

  return lines.join("\n");
}

/** Serializa a lista de posts num bloco legível pro modelo (pt-BR, sem JSON cru). */
export function renderPosts(posts: PostSummaryForAnalysis[]): string {
  return posts.map((post, index) => renderPost(post, index)).join("\n\n");
}

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: FORMATS,
      description: "Formato de conteudo do post.",
    },
  },
  required: ["format"],
  additionalProperties: false,
} as const;

const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    report: {
      type: "string",
      description:
        "Relatorio executivo em Markdown pt-BR: padroes por formato, o que esta funcionando, o que abandonar.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "3 a 5 sugestoes concretas de proximos posts (uma frase cada).",
    },
  },
  required: ["report", "suggestions"],
  additionalProperties: false,
} as const;

/**
 * Implementação da porta SocialAnalyst sobre um ChatModel qualquer. A MilWeb é
 * uma agência que vende sites premium pra pequenos negócios -- os prompts
 * avaliam os posts do Instagram sob essa ótica.
 */
export class ChatSocialAnalyst implements SocialAnalyst {
  constructor(private readonly chat: ChatModel) {}

  async classifyFormat(caption: string | null, mediaType: string): Promise<SocialPostFormat> {
    const result = await this.chat.complete({
      maxTokens: 500,
      effort: "low",
      schema: { name: "classificar_post", definition: CLASSIFY_SCHEMA },
      system:
        "Você classifica posts do Instagram da MilWeb (agência que vende sites premium\n" +
        "para pequenos negócios no Brasil) num formato de conteúdo. Formatos:\n" +
        "REDESIGN = redesign de um site real de empresa; BEFORE_AFTER = comparação\n" +
        "antes x depois; TIMELAPSE = construção acelerada/making of; REVIEW = avaliação\n" +
        "ou análise crítica de um site; ANIMATION = demonstração de animação, parallax\n" +
        "ou efeito de scroll; CODE_SETUP = código, stack, setup, bastidor técnico;\n" +
        "OTHER = qualquer outra coisa. Responda apenas o JSON.",
      user: `Legenda do post (tipo de mídia: ${mediaType}):\n\n${caption ?? "(sem legenda)"}`,
    });

    if (result.stopReason === "refusal") {
      throw new Error("A IA recusou a classificação.");
    }
    const parsed = JSON.parse(result.text) as { format: unknown };
    // Modelo aberto pode devolver algo fora do enum; OTHER é o balde seguro.
    return FORMATS.includes(parsed.format as SocialPostFormat)
      ? (parsed.format as SocialPostFormat)
      : "OTHER";
  }

  async analyze(posts: PostSummaryForAnalysis[]): Promise<SocialAnalysis> {
    const result = await this.chat.complete({
      maxTokens: 3000,
      effort: "medium",
      schema: { name: "analisar_posts", definition: ANALYZE_SCHEMA },
      system:
        "Você é estrategista de conteúdo da MilWeb (agência de sites premium para\n" +
        "pequenos negócios no Brasil; público-alvo dos posts = donos de empresas\n" +
        "locais, NUNCA outros desenvolvedores). Analise as métricas dos posts e\n" +
        "escreva: quais formatos têm melhor retenção/alcance/conversão, com números;\n" +
        "padrões entre os que performam; o que abandonar; e sugestões de próximos\n" +
        "posts que maximizem contatos comerciais. Baseie-se só nos dados fornecidos;\n" +
        "se a amostra de um formato for pequena (menos de 3 posts), diga isso em vez\n" +
        "de concluir com confiança.",
      user: `Analise os posts abaixo:\n\n${renderPosts(posts)}`,
    });

    if (result.stopReason === "refusal") {
      throw new Error("A IA recusou a geração do relatório.");
    }
    const parsed = JSON.parse(result.text) as { report: unknown; suggestions: unknown };
    if (typeof parsed.report !== "string" || !Array.isArray(parsed.suggestions)) {
      throw new Error("A IA não devolveu uma análise válida.");
    }
    return {
      report: parsed.report,
      suggestions: parsed.suggestions.filter((s): s is string => typeof s === "string"),
    };
  }
}
