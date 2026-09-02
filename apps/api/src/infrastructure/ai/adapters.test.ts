import { describe, expect, it, vi } from "vitest";
import type { ChatModel, ChatRequest, ChatResult } from "../../domain/services/chat-model.js";
import type { LeadAiContext } from "../../domain/services/lead-ai.js";
import type { PostSummaryForAnalysis } from "../../domain/services/social-analyst.js";
import { ChatLeadAi } from "./lead-ai.js";
import { ChatSocialAnalyst } from "./social-analyst.js";

function fake(result: Partial<ChatResult>): ChatModel & { calls: ChatRequest[] } {
  const calls: ChatRequest[] = [];
  return {
    label: "fake",
    calls,
    async complete(request) {
      calls.push(request);
      return { text: "", stopReason: "end", ...result };
    },
  };
}

const context: LeadAiContext = {
  organizationName: "MilWeb",
  lead: {
    title: "Padaria do Zé",
    status: "OPEN",
    stageName: "Contato",
    source: "INSTAGRAM",
    value: null,
    currency: "BRL",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    tags: ["local"],
    contacts: [{ name: "Zé", role: "dono", email: null }],
    recentNotes: [],
  },
  company: null,
  audit: null,
  recentActivities: [],
} as unknown as LeadAiContext;

describe("ChatLeadAi", () => {
  it("scoreLead pede JSON com schema, clampa a nota e devolve a justificativa", async () => {
    const chat = fake({ text: JSON.stringify({ score: 137.4, rationale: "Site inexistente." }) });
    const result = await new ChatLeadAi(chat).scoreLead(context);

    expect(result).toEqual({ score: 100, rationale: "Site inexistente." });
    expect(chat.calls[0]?.schema?.name).toBe("avaliar_lead");
    expect(chat.calls[0]?.user).toContain("Padaria do Zé");
    expect(chat.calls[0]?.system).toContain('"MilWeb"');
  });

  it("scoreLead rejeita JSON sem número", async () => {
    const chat = fake({ text: JSON.stringify({ score: "alto", rationale: "x" }) });
    await expect(new ChatLeadAi(chat).scoreLead(context)).rejects.toThrow(/score válido/);
  });

  it("draftMessage devolve o texto aparado e leva modelo + instruções no pedido", async () => {
    const chat = fake({ text: "  Oi Zé, vi que a padaria não tem site.  " });
    const text = await new ChatLeadAi(chat).draftMessage(context, {
      channel: "WHATSAPP",
      templateBody: "Olá {nome}",
      instructions: "seja breve",
    });
    expect(text).toBe("Oi Zé, vi que a padaria não tem site.");
    expect(chat.calls[0]?.schema).toBeUndefined();
    expect(chat.calls[0]?.user).toContain("Olá {nome}");
    expect(chat.calls[0]?.user).toContain("seja breve");
    expect(chat.calls[0]?.user).toContain("WhatsApp");
  });

  it("recusa do modelo vira erro", async () => {
    const chat = fake({ stopReason: "refusal" });
    await expect(new ChatLeadAi(chat).reportLead(context)).rejects.toThrow(/recusou/);
  });
});

describe("ChatSocialAnalyst", () => {
  const post = {
    publishedAt: new Date("2026-08-20T00:00:00Z"),
    format: "OTHER",
    mediaType: "REEL",
    caption: "Antes e depois do site da clínica",
    reach: 1200,
    views: 3000,
    avgWatchTimeMs: 8500,
    likes: 40,
    comments: 3,
    saved: 5,
    shares: 2,
    profileVisits: 10,
    profileActivity: null,
  } as unknown as PostSummaryForAnalysis;

  it("classifyFormat devolve o formato do JSON", async () => {
    const chat = fake({ text: JSON.stringify({ format: "BEFORE_AFTER" }) });
    expect(await new ChatSocialAnalyst(chat).classifyFormat("antes e depois", "REEL")).toBe(
      "BEFORE_AFTER",
    );
  });

  it("formato fora do enum cai em OTHER (modelo aberto pode inventar)", async () => {
    const chat = fake({ text: JSON.stringify({ format: "TUTORIAL" }) });
    expect(await new ChatSocialAnalyst(chat).classifyFormat(null, "IMAGE")).toBe("OTHER");
  });

  it("analyze serializa as métricas e filtra sugestões não-textuais", async () => {
    const chat = fake({ text: JSON.stringify({ report: "# ok", suggestions: ["a", 3, "b"] }) });
    const analysis = await new ChatSocialAnalyst(chat).analyze([post]);
    expect(analysis).toEqual({ report: "# ok", suggestions: ["a", "b"] });
    expect(chat.calls[0]?.user).toContain("Retenção média: 9s");
    expect(chat.calls[0]?.user).toContain("Alcance: 1200");
  });

  it("chat quebrado propaga o erro", async () => {
    const chat: ChatModel = {
      label: "fake",
      complete: vi.fn(async () => {
        throw new Error("A API de IA (nvidia:x) respondeu 429");
      }),
    };
    await expect(new ChatSocialAnalyst(chat).analyze([post])).rejects.toThrow(/429/);
  });
});
