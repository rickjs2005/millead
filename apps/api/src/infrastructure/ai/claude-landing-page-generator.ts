import Anthropic from "@anthropic-ai/sdk";
import type {
  LandingPageContext,
  LandingPageGenerator,
} from "../../domain/services/landing-page-generator.js";

function renderContext(ctx: LandingPageContext): string {
  const c = ctx.company;
  const lines: string[] = [];
  lines.push(`Empresa: ${c.name}`);
  if (c.segment) lines.push(`Segmento: ${c.segment}`);
  if (c.sizeEstimate) lines.push(`Porte: ${c.sizeEstimate}`);
  if (c.city || c.state) lines.push(`Local: ${[c.city, c.state].filter(Boolean).join(", ")}`);
  if (c.phone) lines.push(`Telefone/WhatsApp: ${c.phone}`);
  if (c.email) lines.push(`E-mail: ${c.email}`);
  if (c.websites.length > 0) lines.push(`Site atual: ${c.websites.join(", ")}`);
  if (c.socials.length > 0) {
    lines.push(`Redes: ${c.socials.map((s) => `${s.platform}: ${s.handleOrUrl}`).join(" | ")}`);
  }
  if (c.notes) lines.push(`Notas do vendedor sobre a empresa: ${c.notes}`);
  if (ctx.audit) {
    lines.push("");
    lines.push("Auditoria do site atual (notas 0-100):");
    for (const s of ctx.audit.scores) lines.push(`- ${s.category}: ${s.score}`);
    if (ctx.audit.summary) lines.push(ctx.audit.summary);
  }
  if (ctx.brief) {
    lines.push("");
    lines.push(`Instruções do vendedor: ${ctx.brief}`);
  }
  return lines.join("\n");
}

/** Remove cerca de código (```html ... ```) se o modelo embrulhar a resposta. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = /^```(?:html)?\s*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
  return match ? match[1]! : trimmed;
}

export class ClaudeLandingPageGenerator implements LandingPageGenerator {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    // Geração é longa (HTML grande + thinking) -- timeout folgado.
    this.client = new Anthropic({ apiKey, timeout: 10 * 60 * 1000 });
  }

  async generate(context: LandingPageContext): Promise<string> {
    const goal =
      context.kind === "DEMO_SITE"
        ? "Crie o SITE DEMONSTRATIVO da empresa descrita abaixo -- é o que a agência vai mostrar ao dono do negócio dizendo " +
          "\"veja como o site de vocês poderia ficar\". A página vende os produtos/serviços DA EMPRESA para os clientes finais dela " +
          "(hero forte, serviços, diferenciais, depoimentos genéricos plausíveis SEM inventar nomes reais, chamada pra contato/WhatsApp)."
        : `Crie uma PÁGINA DE PROPOSTA da agência "${context.organizationName}" endereçada à empresa descrita abaixo. ` +
          "A página convence o dono do negócio a contratar a agência: mostre o que a auditoria encontrou no site atual " +
          "(use as notas reais), o impacto disso em clientes perdidos, o que a agência faria, e uma chamada clara pra fechar negócio.";

    // Streaming obrigatório: max_tokens alto estoura timeout HTTP sem stream.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 48000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system:
        "Você é um designer/desenvolvedor sênior que produz landing pages de altíssima qualidade em um único arquivo HTML. Regras obrigatórias:\n" +
        "- Responda SOMENTE com o documento HTML completo, começando em <!doctype html>. Nada antes nem depois, sem cerca de código.\n" +
        "- Tudo em português do Brasil.\n" +
        "- 100% autocontido: CSS inline em <style>, ícones/ilustrações em SVG inline, NENHUM recurso externo (sem CDN, sem Google Fonts, sem <img src=\"http...\">, sem JavaScript).\n" +
        "- Interações só com CSS (hover, :target, details/summary).\n" +
        "- Responsivo (mobile-first), com boa hierarquia, contraste acessível e meta viewport.\n" +
        "- Design distinto e profissional adequado ao segmento -- evite estética genérica: nada de gradientes roxos clichês; escolha uma paleta coerente com o negócio; capriche em tipografia (font stacks do sistema), espaçamento e micro-detalhes.\n" +
        "- Use apenas dados reais fornecidos (telefone, e-mail, cidade). Se faltar um dado, escreva a seção sem ele -- NUNCA invente telefone, endereço ou depoimento com nome de pessoa real.\n" +
        "- Se houver telefone, o botão principal de contato vira link de WhatsApp (https://wa.me/55 + números).\n" +
        "- No rodapé, inclua um crédito discreto \"Feito por <nome da agência fornecida>\" -- é a assinatura comercial da agência.",
      messages: [
        {
          role: "user",
          content: `${goal}\n\nTítulo de trabalho: ${context.title}\nAgência: ${context.organizationName}\n\nDados:\n${renderContext(context)}`,
        },
      ],
    });

    const response = await stream.finalMessage();
    if (response.stop_reason === "refusal") {
      throw new Error("A IA recusou a geração da página.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("A página ficou grande demais e foi cortada -- tente um brief mais simples.");
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const html = stripCodeFence(text);
    if (!/^<!doctype html>/i.test(html.trim())) {
      throw new Error("A IA não devolveu um documento HTML válido.");
    }
    return html;
  }
}
