/**
 * Catálogo de opções do gerador de prompt de site. Cada opção carrega um
 * `guidance` -- o texto que entra no prompt final descrevendo aquela
 * escolha pra IA (ChatGPT/Claude). Assim o prompt fica rico sem o usuário
 * precisar escrever tudo à mão.
 */

export interface Option {
  value: string;
  label: string;
  guidance: string;
}

export const DESIGN_STYLES: Option[] = [
  {
    value: "minimalista",
    label: "Minimalista",
    guidance:
      "muito espaço em branco, tipografia grande e limpa, poucos elementos por seção, elegância pela contenção; nada de excessos.",
  },
  {
    value: "cinematografico",
    label: "Cinematográfico",
    guidance:
      "hero imersivo em tela cheia, imagens/vídeo grandes, gradientes escuros sobre foto, animações de revelação no scroll, sensação de filme premium.",
  },
  {
    value: "institucional",
    label: "Corporativo / Institucional",
    guidance:
      "sério e confiável, estrutura clara, paleta sóbria (azuis/neutros), foco em credibilidade e prova social; transmite solidez.",
  },
  {
    value: "luxo",
    label: "Luxo / Premium",
    guidance:
      "sofisticado, fontes serifadas de caráter, paleta contida (preto/dourado/cru), muito respiro, fotografia de alto padrão, microinterações discretas.",
  },
  {
    value: "tech",
    label: "Moderno / Tech (SaaS)",
    guidance:
      "vibe de produto de tecnologia: dark mode, gradientes sutis, glassmorphism leve, cards, badges, seções de features com ícones.",
  },
  {
    value: "colorido",
    label: "Divertido / Colorido",
    guidance:
      "cores vibrantes, formas orgânicas, ilustrações, leveza e energia; visual acolhedor e informal.",
  },
  {
    value: "editorial",
    label: "Editorial / Revista",
    guidance:
      "grid assimétrico, tipografia como protagonista, muito espaço negativo, inspirado em revistas de moda/arquitetura.",
  },
];

export const FRAMEWORKS: Option[] = [
  {
    value: "html-css",
    label: "HTML + CSS puro",
    guidance:
      "um único arquivo HTML com CSS embutido em <style> (sem dependências, sem build) — pronto pra abrir no navegador.",
  },
  {
    value: "html-tailwind",
    label: "HTML + Tailwind (CDN)",
    guidance:
      "um único arquivo HTML usando Tailwind via CDN (script do play CDN) — sem build, pronto pra abrir no navegador.",
  },
  {
    value: "react-tailwind",
    label: "React + Tailwind",
    guidance:
      "componentes React funcionais com Tailwind; organize em componentes por seção (Hero, Sobre, etc.).",
  },
  {
    value: "next-tailwind",
    label: "Next.js (App Router) + Tailwind",
    guidance:
      "Next.js 14+ com App Router e Tailwind; um componente por seção em /components, montados em app/page.tsx; use next/image e next/font.",
  },
  {
    value: "vue-tailwind",
    label: "Vue + Tailwind",
    guidance: "Vue 3 (script setup) com Tailwind; um componente .vue por seção.",
  },
  {
    value: "astro-tailwind",
    label: "Astro + Tailwind",
    guidance: "Astro com Tailwind; um componente .astro por seção, montados em index.astro.",
  },
];

export const LANGUAGES: Option[] = [
  { value: "typescript", label: "TypeScript", guidance: "TypeScript, com tipagem onde fizer sentido." },
  { value: "javascript", label: "JavaScript", guidance: "JavaScript moderno (ES modules)." },
];

export const ANIMATIONS: Option[] = [
  { value: "none", label: "Nenhuma (estático)", guidance: "sem animações; foco em performance e clareza." },
  {
    value: "subtle",
    label: "Sutis (hover/transições CSS)",
    guidance: "microinterações discretas via CSS (hover, transições suaves), nada exagerado.",
  },
  {
    value: "scroll",
    label: "Revelações no scroll",
    guidance:
      "elementos aparecem com fade/slide ao entrar na viewport (IntersectionObserver ou lib leve); sempre com easing suave.",
  },
  {
    value: "gsap",
    label: "GSAP + ScrollTrigger",
    guidance:
      "animações cinematográficas com GSAP + ScrollTrigger (parallax, revelações, timeline no hero); elegantes, nunca poluídas.",
  },
  {
    value: "framer",
    label: "Framer Motion",
    guidance: "animações declarativas com Framer Motion (entrada, hover, layout); suaves e coerentes.",
  },
];

export const SECTIONS: Option[] = [
  { value: "nav", label: "Header / Navegação", guidance: "cabeçalho fixo com logo e navegação (âncoras)." },
  { value: "hero", label: "Hero", guidance: "hero com título forte, subtítulo e CTA principal em destaque." },
  { value: "sobre", label: "Sobre", guidance: "quem é o negócio e por que confiar nele." },
  { value: "servicos", label: "Serviços / Produtos", guidance: "grade de serviços ou produtos, cada um com ícone/foto e descrição curta." },
  { value: "diferenciais", label: "Diferenciais", guidance: "por que escolher este negócio — 3 a 6 pontos." },
  { value: "numeros", label: "Números / Resultados", guidance: "estatísticas de impacto (anos, clientes, projetos)." },
  { value: "depoimentos", label: "Depoimentos", guidance: "prova social com depoimentos de clientes." },
  { value: "galeria", label: "Galeria / Portfólio", guidance: "grade de imagens de trabalhos/produtos." },
  { value: "precos", label: "Planos / Preços", guidance: "tabela de planos ou faixa de preço com CTA em cada." },
  { value: "faq", label: "FAQ", guidance: "perguntas frequentes em acordeão." },
  { value: "cta", label: "CTA final", guidance: "chamada final forte, tela limpa, botão grande." },
  { value: "contato", label: "Contato / Formulário", guidance: "formulário de contato e/ou botão de WhatsApp." },
  { value: "mapa", label: "Mapa / Localização", guidance: "endereço e mapa embutido." },
  { value: "footer", label: "Footer", guidance: "rodapé com contato, redes sociais e copyright." },
];

export const GOALS: Option[] = [
  { value: "whatsapp", label: "Gerar contato no WhatsApp", guidance: "converter o visitante em uma conversa no WhatsApp; botões de WhatsApp bem visíveis, com mensagem pré-preenchida." },
  { value: "lead", label: "Capturar leads (formulário)", guidance: "capturar dados do visitante num formulário curto e objetivo." },
  { value: "venda", label: "Vender um produto/serviço", guidance: "levar à compra; destaque de oferta, benefícios e prova social, com CTA de compra." },
  { value: "agendamento", label: "Agendar reunião/consulta", guidance: "levar o visitante a agendar um horário; CTA de agendamento em destaque." },
  { value: "institucional", label: "Apresentar a empresa", guidance: "passar credibilidade e apresentar a empresa (institucional), com contato ao fim." },
  { value: "evento", label: "Divulgar um evento", guidance: "divulgar um evento com data, local e inscrição/CTA." },
];

export const DEFAULT_SECTIONS = ["nav", "hero", "sobre", "servicos", "diferenciais", "contato", "footer"];

export function findGuidance(list: Option[], value: string): string {
  return list.find((o) => o.value === value)?.guidance ?? "";
}
export function findLabel(list: Option[], value: string): string {
  return list.find((o) => o.value === value)?.label ?? value;
}
