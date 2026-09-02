import type { ChatModel } from "../../domain/services/chat-model.js";
import { AnthropicChatModel } from "./anthropic-chat-model.js";
import { OpenAiCompatibleChatModel } from "./openai-compatible-chat-model.js";

export type AiEnv = {
  AI_PROVIDER?: "anthropic" | "nvidia";
  ANTHROPIC_API_KEY?: string;
  AI_MODEL: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_MODEL: string;
  NVIDIA_BASE_URL: string;
};

/**
 * Escolhe o provedor de IA a partir do ambiente.
 *
 * Sem `AI_PROVIDER`, a chave presente decide -- e a NVIDIA ganha o desempate
 * porque é gratuita: quem colocou a chave dela quer usá-la. Sem chave
 * nenhuma, devolve null e os endpoints de IA seguem respondendo 503.
 * `AI_PROVIDER` explícito sem a chave correspondente é erro de configuração
 * e derruba o boot com mensagem clara, em vez de cair em silêncio no outro.
 */
export function buildChatModel(env: AiEnv): ChatModel | null {
  const provider =
    env.AI_PROVIDER ?? (env.NVIDIA_API_KEY ? "nvidia" : env.ANTHROPIC_API_KEY ? "anthropic" : null);

  if (provider === null) return null;

  if (provider === "nvidia") {
    if (!env.NVIDIA_API_KEY) {
      throw new Error("AI_PROVIDER=nvidia exige NVIDIA_API_KEY no ambiente.");
    }
    return new OpenAiCompatibleChatModel({
      provider: "nvidia",
      apiKey: env.NVIDIA_API_KEY,
      baseUrl: env.NVIDIA_BASE_URL,
      model: env.NVIDIA_MODEL,
    });
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("AI_PROVIDER=anthropic exige ANTHROPIC_API_KEY no ambiente.");
  }
  return new AnthropicChatModel(env.ANTHROPIC_API_KEY, env.AI_MODEL);
}
