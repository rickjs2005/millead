import { describe, expect, it, vi } from "vitest";
import {
  OpenAiCompatibleChatModel,
  extractJson,
  stripReasoning,
} from "./openai-compatible-chat-model.js";

function sse(chunks: unknown[]): Response {
  const body = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function model(fetchImpl: typeof fetch) {
  return new OpenAiCompatibleChatModel({
    provider: "nvidia",
    apiKey: "k",
    baseUrl: "https://integrate.api.nvidia.com/v1/",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    fetchImpl,
  });
}

const schema = {
  name: "avaliar_lead",
  definition: { type: "object", properties: { score: { type: "integer" } }, required: ["score"] },
};

describe("OpenAiCompatibleChatModel", () => {
  it("monta o POST no formato OpenAI e junta o texto do stream", async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        { choices: [{ delta: { content: "Olá" } }] },
        { choices: [{ delta: { content: ", tudo bem?" }, finish_reason: "stop" }] },
      ]),
    );
    const result = await model(fetchImpl as unknown as typeof fetch).complete({
      system: "S",
      user: "U",
      maxTokens: 100,
      effort: "low",
    });

    expect(result).toEqual({ text: "Olá, tudo bem?", stopReason: "end" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
    expect(body.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect(body.stream).toBe(true);
    expect(body.tools).toBeUndefined();
  });

  it("com schema força a função e devolve os argumentos acumulados do tool call", async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        { choices: [{ delta: { tool_calls: [{ function: { arguments: '{"sco' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ function: { arguments: 're": 72}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      ]),
    );
    const result = await model(fetchImpl as unknown as typeof fetch).complete({
      system: "S",
      user: "U",
      maxTokens: 100,
      effort: "low",
      schema,
    });

    expect(JSON.parse(result.text)).toEqual({ score: 72 });
    expect(result.stopReason).toBe("end");

    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.tools[0].function.name).toBe("avaliar_lead");
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "avaliar_lead" } });
    expect(body.messages[0].content).toContain("avaliar_lead");
  });

  it("sem tool call, extrai o JSON do texto e ignora o bloco de raciocínio", async () => {
    const fetchImpl = vi.fn(async () =>
      sse([
        { choices: [{ delta: { content: "<think>pensando...</think>Aqui vai:\n```json\n{\"score\": 40}\n```" } }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
      ]),
    );
    const result = await model(fetchImpl as unknown as typeof fetch).complete({
      system: "S",
      user: "U",
      maxTokens: 100,
      effort: "low",
      schema,
    });
    expect(JSON.parse(result.text)).toEqual({ score: 40 });
  });

  it("aceita resposta JSON sem stream (servidor que ignora stream:true)", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "<think>x</think>texto final" }, finish_reason: "length" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    const result = await model(fetchImpl as unknown as typeof fetch).complete({
      system: "S",
      user: "U",
      maxTokens: 10,
      effort: "low",
    });
    expect(result).toEqual({ text: "texto final", stopReason: "max_tokens" });
  });

  it("erro HTTP vira erro legível com o status", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));
    await expect(
      model(fetchImpl as unknown as typeof fetch).complete({
        system: "S",
        user: "U",
        maxTokens: 10,
        effort: "low",
      }),
    ).rejects.toThrow(/429/);
  });

  it("schema pedido e nada de JSON na resposta é erro", async () => {
    const fetchImpl = vi.fn(async () =>
      sse([{ choices: [{ delta: { content: "não sei" }, finish_reason: "stop" }] }]),
    );
    await expect(
      model(fetchImpl as unknown as typeof fetch).complete({
        system: "S",
        user: "U",
        maxTokens: 10,
        effort: "low",
        schema,
      }),
    ).rejects.toThrow(/JSON válido/);
  });
});

describe("helpers", () => {
  it("stripReasoning remove blocos fechados e abertos", () => {
    expect(stripReasoning("<think>a</think>b<think>c")).toBe("b");
  });
  it("extractJson pega o primeiro objeto, com ou sem cerca", () => {
    expect(extractJson('claro: {"a":1} fim')).toBe('{"a":1}');
    expect(extractJson("```json\n{\"a\":{\"b\":2}}\n```")).toBe('{"a":{"b":2}}');
    expect(extractJson("nada aqui")).toBeNull();
  });
});
