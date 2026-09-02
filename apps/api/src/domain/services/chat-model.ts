/**
 * A porta de "modelo de chat" que os recursos de IA da casa usam.
 *
 * Existe pra que score de lead, diretor criativo e analista social sejam
 * escritos UMA vez, em cima de uma operação só (system + pedido → texto ou
 * JSON), e o provedor por trás seja decidido por configuração: Anthropic
 * (Claude) ou qualquer API compatível com o formato OpenAI -- hoje, a API
 * gratuita da NVIDIA com o Nemotron.
 */

export type ChatEffort = "low" | "medium" | "high";

export type ChatJsonSchema = {
  /** Nome curto, sem espaços -- vira o nome da função no tool calling. */
  name: string;
  /** JSON Schema (draft 2020-12) do objeto esperado. */
  definition: Record<string, unknown>;
};

export type ChatRequest = {
  system: string;
  user: string;
  maxTokens: number;
  effort: ChatEffort;
  /** Quando presente, `text` do resultado é um documento JSON que segue o schema. */
  schema?: ChatJsonSchema;
};

export type ChatStopReason = "end" | "max_tokens" | "refusal";

export type ChatResult = {
  text: string;
  stopReason: ChatStopReason;
};

export interface ChatModel {
  /** Rótulo humano do provedor+modelo (aparece em /ai/status e nos logs). */
  readonly label: string;
  complete(request: ChatRequest): Promise<ChatResult>;
}
