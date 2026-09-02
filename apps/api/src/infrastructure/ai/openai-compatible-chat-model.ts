import type { ChatModel, ChatRequest, ChatResult } from "../../domain/services/chat-model.js";

/**
 * ChatModel sobre qualquer API no formato OpenAI (`POST {baseUrl}/chat/completions`).
 * O alvo de casa é a API gratuita da NVIDIA (integrate.api.nvidia.com) com o
 * Nemotron 3.5 Lightning; OpenRouter, Groq, vLLM e afins entram trocando
 * `baseUrl` + `model`.
 *
 * Sem SDK de propósito: é um POST com streaming SSE, e o pacote oficial
 * traria dependência e superfície que não usamos.
 *
 * JSON estruturado: quando o pedido traz schema, o modelo é obrigado a chamar
 * uma função cujos parâmetros SÃO o schema (`tool_choice` forçado) -- é o
 * mecanismo mais confiável nesses servidores. Se o servidor ignorar a
 * ferramenta e responder em texto, o JSON é extraído do texto. Blocos de
 * raciocínio (`<think>…</think>`) que alguns modelos abertos colocam no
 * conteúdo são descartados antes de qualquer parse.
 */
export class OpenAiCompatibleChatModel implements ChatModel {
  readonly label: string;

  constructor(
    private readonly config: {
      apiKey: string;
      baseUrl: string;
      model: string;
      /** rótulo do provedor pro /ai/status (ex.: "nvidia") */
      provider: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    },
  ) {
    this.label = `${config.provider}:${config.model}`;
  }

  async complete(request: ChatRequest): Promise<ChatResult> {
    const doFetch = this.config.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 10 * 60 * 1000);

    try {
      const response = await doFetch(
        `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(buildBody(this.config.model, request)),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 300);
        throw new Error(
          `A API de IA (${this.label}) respondeu ${response.status}${detail ? `: ${detail}` : ""}`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      const raw = contentType.includes("text/event-stream")
        ? await readSse(response)
        : readJson(await response.json());

      return finish(raw, request);
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ------------------------------------------------------------------------ */

type RawCompletion = {
  content: string;
  toolArguments: string;
  finishReason: string | null;
};

function buildBody(model: string, request: ChatRequest): Record<string, unknown> {
  const system = request.schema
    ? `${request.system}\n\nResponda SOMENTE chamando a função "${request.schema.name}" com um objeto que siga este JSON Schema, sem texto fora dele:\n${JSON.stringify(request.schema.definition)}`
    : request.system;

  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: request.user },
    ],
    max_tokens: request.maxTokens,
    // JSON pede determinismo; texto de prospecção pede alguma variação.
    temperature: request.schema ? 0.2 : 0.6,
    stream: true,
    ...(request.schema
      ? {
          tools: [
            {
              type: "function",
              function: {
                name: request.schema.name,
                description: "Devolve a resposta no formato estruturado pedido.",
                parameters: request.schema.definition,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: request.schema.name } },
        }
      : {}),
  };
}

/** Lê um stream SSE de chat completions acumulando conteúdo e argumentos de função. */
async function readSse(response: Response): Promise<RawCompletion> {
  const acc: RawCompletion = { content: "", toolArguments: "", finishReason: null };
  const body = response.body;
  if (!body) return acc;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let chunk: unknown;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return; // linha parcial ou keep-alive -- ignora
    }
    applyChunk(acc, chunk);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      consume(buffer.slice(0, newline).replace(/\r$/, ""));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) consume(buffer.trim());
  return acc;
}

type Choice = {
  delta?: { content?: string | null; tool_calls?: ToolCallDelta[] };
  message?: { content?: string | null; tool_calls?: ToolCallDelta[] };
  finish_reason?: string | null;
};
type ToolCallDelta = { function?: { arguments?: string | null } };

function applyChunk(acc: RawCompletion, chunk: unknown) {
  const choice = (chunk as { choices?: Choice[] })?.choices?.[0];
  if (!choice) return;
  const delta = choice.delta ?? choice.message;
  if (delta?.content) acc.content += delta.content;
  for (const call of delta?.tool_calls ?? []) {
    if (call.function?.arguments) acc.toolArguments += call.function.arguments;
  }
  if (choice.finish_reason) acc.finishReason = choice.finish_reason;
}

/** Resposta sem stream (servidor que ignora `stream: true`). */
function readJson(body: unknown): RawCompletion {
  const acc: RawCompletion = { content: "", toolArguments: "", finishReason: null };
  applyChunk(acc, body);
  return acc;
}

function finish(raw: RawCompletion, request: ChatRequest): ChatResult {
  const stopReason = mapFinishReason(raw.finishReason);
  const content = stripReasoning(raw.content);

  if (!request.schema) {
    return { text: content.trim(), stopReason };
  }

  const json = raw.toolArguments.trim() || extractJson(content);
  if (!json) {
    if (stopReason === "end") {
      throw new Error("A IA não devolveu um JSON válido.");
    }
    return { text: "", stopReason };
  }
  // Materializa pra garantir que é JSON de verdade; o adaptador faz o parse tipado.
  try {
    JSON.parse(json);
  } catch {
    throw new Error("A IA não devolveu um JSON válido.");
  }
  return { text: json, stopReason };
}

function mapFinishReason(reason: string | null): ChatResult["stopReason"] {
  if (reason === "length") return "max_tokens";
  if (reason === "content_filter") return "refusal";
  return "end";
}

/** Remove blocos <think>…</think> (fechados ou não) que modelos abertos emitem no conteúdo. */
export function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "");
}

/** Pega o primeiro objeto JSON de um texto (com ou sem cerca de código). */
export function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}
