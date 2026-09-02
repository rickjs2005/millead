import Anthropic from "@anthropic-ai/sdk";
import type { ChatModel, ChatRequest, ChatResult } from "../../domain/services/chat-model.js";

/**
 * ChatModel sobre a API da Anthropic. Mantém exatamente o que os adaptadores
 * antigos faziam: thinking adaptativo, `output_config.effort` e structured
 * output por JSON schema quando o pedido traz um.
 *
 * Sempre em streaming: geração longa (direção criativa, 32k tokens) sem
 * stream estoura o timeout HTTP, e pra pedido curto o stream não custa nada.
 */
export class AnthropicChatModel implements ChatModel {
  private readonly client: Anthropic;
  readonly label: string;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, timeout: 10 * 60 * 1000 });
    this.label = `anthropic:${model}`;
  }

  async complete(request: ChatRequest): Promise<ChatResult> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxTokens,
      thinking: { type: "adaptive" },
      output_config: {
        effort: request.effort,
        ...(request.schema
          ? { format: { type: "json_schema", schema: request.schema.definition } }
          : {}),
      },
      system: request.system,
      messages: [{ role: "user", content: request.user }],
    } as Anthropic.MessageStreamParams);

    const response = await stream.finalMessage();

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return { text, stopReason: mapStopReason(response.stop_reason) };
  }
}

function mapStopReason(reason: string | null): ChatResult["stopReason"] {
  if (reason === "refusal") return "refusal";
  if (reason === "max_tokens") return "max_tokens";
  return "end";
}
