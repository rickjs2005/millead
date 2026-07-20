/**
 * Catálogo de opções do gerador de prompt de site. Cada opção carrega um
 * `guidance` -- o texto que entra no prompt final descrevendo aquela
 * escolha pra IA (ChatGPT/Claude). Estilos trazem também `reference` com
 * exemplos reais de marcas/sites, que aparecem na tela e entram no prompt
 * como inspiração visual.
 */

export interface Option {
  value: string;
  label: string;
  guidance: string;
  /** Exemplos reais de referência (só nos estilos de design). */
  reference?: string;
}

export const DESIGN_STYLES: Option[] = [
  {
    value: "minimalista",
    label: "Minimalista",
    guidance:
      "muito espaço em branco, tipografia grande e limpa, poucos elementos por seção, elegância pela contenção; nada de excessos.",
    reference: "Apple, Notion, Vercel",
  },
  {
    value: "glassmorphism",
    label: "Glassmorphism (vidro)",
    guidance:
      "camadas de vidro fosco translúcido (backdrop-blur), profundidade em camadas, sombras suaves, geralmente sobre fundo escuro com gradientes; o blur comunica hierarquia (o que está à frente x recuado).",
    reference: "Apple (macOS/visionOS), Stripe",
  },
  {
    value: "bento",
    label: "Bento grid",
    guidance:
      "grade modular de cards de tamanhos variados (estilo marmita japonesa), cada card é uma micro-história autocontida; quebra o scroll linear e é fácil de escanear. Popularizado pela Apple nos keynotes.",
    reference: "Apple (keynote), Vercel, Linear",
  },
  {
    value: "cinematografico",
    label: "Cinematográfico",
    guidance:
      "hero imersivo em tela cheia, imagens/vídeo grandes, gradientes escuros sobre foto, animações de revelação no scroll, sensação de filme premium.",
    reference: "Igloo Inc, Locomotive, vencedores do Awwwards",
  },
  {
    value: "tech",
    label: "Moderno / Tech (SaaS)",
    guidance:
      "vibe de produto de tecnologia: dark mode, gradientes sutis, glassmorphism leve, cards, badges, seções de features com ícones.",
    reference: "Linear, Stripe, Framer",
  },
  {
    value: "aurora",
    label: "Aurora / Gradientes vibrantes",
    guidance:
      "fundos escuros com gradientes fluidos e luminosos (aurora boreal), brilhos suaves, cores que transitam; moderno e elegante.",
    reference: "Stripe, Linear, Cred",
  },
  {
    value: "institucional",
    label: "Corporativo / Institucional",
    guidance:
      "sério e confiável, estrutura clara, paleta sóbria (azuis/neutros), foco em credibilidade e prova social; transmite solidez.",
    reference: "IBM, Deloitte, Salesforce",
  },
  {
    value: "luxo",
    label: "Luxo / Premium",
    guidance:
      "sofisticado, fontes serifadas de caráter, paleta contida (preto/dourado/cru), muito respiro, fotografia de alto padrão, microinterações discretas.",
    reference: "Rolex, Aston Martin, Bottega Veneta",
  },
  {
    value: "editorial",
    label: "Editorial / Revista",
    guidance:
      "grid assimétrico, tipografia como protagonista, muito espaço negativo, inspirado em revistas de moda/arquitetura.",
    reference: "Kinfolk, Cereal, Bureau Cool",
  },
  {
    value: "brutalismo",
    label: "Brutalismo (soft)",
    guidance:
      "bordas grossas, alto contraste, tipografia crua e grande, layout propositalmente 'sem polimento' — mas usável, com fontes amigáveis e respiro (soft brutalism).",
    reference: "Gumroad, Figma (campanhas), Awwwards brutalist",
  },
  {
    value: "claymorphism",
    label: "Claymorphism (fofo 3D)",
    guidance:
      "elementos com aparência de argila: 3D arredondado, sombras suaves internas/externas, cores pastéis, ícones grandes e expressivos; lúdico e acolhedor.",
    reference: "Duolingo, apps de wellness/gaming",
  },
  {
    value: "colorido",
    label: "Divertido / Colorido",
    guidance:
      "cores vibrantes, formas orgânicas, ilustrações, leveza e energia; visual acolhedor e informal.",
    reference: "Mailchimp, Headspace, Slack",
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
    value: "vite-react",
    label: "Vite + React + Tailwind",
    guidance:
      "projeto Vite + React + Tailwind; estrutura leve com um componente por seção e main.tsx montando a página.",
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
    value: "svelte-tailwind",
    label: "SvelteKit + Tailwind",
    guidance: "SvelteKit com Tailwind; um componente .svelte por seção, montados em +page.svelte.",
  },
  {
    value: "astro-tailwind",
    label: "Astro + Tailwind",
    guidance: "Astro com Tailwind; um componente .astro por seção, montados em index.astro.",
  },
];

export const LANGUAGES: Option[] = [
  {
    value: "typescript",
    label: "TypeScript",
    guidance: "TypeScript, com tipagem onde fizer sentido.",
  },
  { value: "javascript", label: "JavaScript", guidance: "JavaScript moderno (ES modules)." },
];

export const ANIMATIONS: Option[] = [
  {
    value: "none",
    label: "Nenhuma (estático)",
    guidance: "sem animações; foco em performance e clareza.",
  },
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
    label: "Framer Motion (Motion)",
    guidance:
      "animações declarativas com Framer Motion / Motion (entrada, hover, layout); suaves e coerentes.",
  },
];

/**
 * Recursos avançados / efeitos (multi-select, opcional) -- é aqui que
 * entram Three.js e cia. São somados ao prompt como "além do básico".
 */
export const EFFECTS: Option[] = [
  {
    value: "three",
    label: "3D com Three.js / R3F",
    guidance:
      "cena 3D interativa com Three.js (ou React Three Fiber, se React/Next) — ex.: objeto 3D no hero, fundo com geometria animada; leve e otimizada.",
  },
  {
    value: "smooth-scroll",
    label: "Scroll suave cinematográfico (Lenis)",
    guidance: "scroll suave com Lenis, sincronizado às animações de scroll (sensação premium).",
  },
  {
    value: "particles",
    label: "Partículas / canvas animado",
    guidance: "fundo com partículas ou canvas animado (leve), reforçando a atmosfera.",
  },
  {
    value: "lottie",
    label: "Lottie (animações After Effects)",
    guidance: "animações vetoriais Lottie em pontos-chave (ícones animados, ilustração no hero).",
  },
  {
    value: "shaders",
    label: "Shaders WebGL / distorção de imagem",
    guidance:
      "efeitos de shader WebGL (distorção de imagem no hover, gradiente animado por shader); usar com parcimônia.",
  },
  {
    value: "cursor",
    label: "Cursor customizado / magnético",
    guidance: "cursor personalizado com efeito magnético nos botões/links (desktop).",
  },
  {
    value: "parallax",
    label: "Parallax",
    guidance: "camadas em parallax no scroll/mouse pra dar profundidade.",
  },
  {
    value: "marquee",
    label: "Marquee / texto rolante",
    guidance: "faixa de texto/logos rolando horizontalmente (marquee) como elemento de ritmo.",
  },
];

export const SECTIONS: Option[] = [
  {
    value: "nav",
    label: "Header / Navegação",
    guidance: "cabeçalho fixo com logo e navegação (âncoras).",
  },
  {
    value: "hero",
    label: "Hero",
    guidance: "hero com título forte, subtítulo e CTA principal em destaque.",
  },
  { value: "sobre", label: "Sobre", guidance: "quem é o negócio e por que confiar nele." },
  {
    value: "servicos",
    label: "Serviços / Produtos",
    guidance: "grade de serviços ou produtos, cada um com ícone/foto e descrição curta.",
  },
  {
    value: "diferenciais",
    label: "Diferenciais",
    guidance: "por que escolher este negócio — 3 a 6 pontos.",
  },
  {
    value: "numeros",
    label: "Números / Resultados",
    guidance: "estatísticas de impacto (anos, clientes, projetos).",
  },
  {
    value: "depoimentos",
    label: "Depoimentos",
    guidance: "prova social com depoimentos de clientes.",
  },
  {
    value: "galeria",
    label: "Galeria / Portfólio",
    guidance: "grade de imagens de trabalhos/produtos.",
  },
  {
    value: "precos",
    label: "Planos / Preços",
    guidance: "tabela de planos ou faixa de preço com CTA em cada.",
  },
  { value: "faq", label: "FAQ", guidance: "perguntas frequentes em acordeão." },
  { value: "cta", label: "CTA final", guidance: "chamada final forte, tela limpa, botão grande." },
  {
    value: "contato",
    label: "Contato / Formulário",
    guidance: "formulário de contato e/ou botão de WhatsApp.",
  },
  { value: "mapa", label: "Mapa / Localização", guidance: "endereço e mapa embutido." },
  { value: "footer", label: "Footer", guidance: "rodapé com contato, redes sociais e copyright." },
];

export const GOALS: Option[] = [
  {
    value: "whatsapp",
    label: "Gerar contato no WhatsApp",
    guidance:
      "converter o visitante em uma conversa no WhatsApp; botões de WhatsApp bem visíveis, com mensagem pré-preenchida.",
  },
  {
    value: "lead",
    label: "Capturar leads (formulário)",
    guidance: "capturar dados do visitante num formulário curto e objetivo.",
  },
  {
    value: "venda",
    label: "Vender um produto/serviço",
    guidance: "levar à compra; destaque de oferta, benefícios e prova social, com CTA de compra.",
  },
  {
    value: "agendamento",
    label: "Agendar reunião/consulta",
    guidance: "levar o visitante a agendar um horário; CTA de agendamento em destaque.",
  },
  {
    value: "institucional",
    label: "Apresentar a empresa",
    guidance: "passar credibilidade e apresentar a empresa (institucional), com contato ao fim.",
  },
  {
    value: "evento",
    label: "Divulgar um evento",
    guidance: "divulgar um evento com data, local e inscrição/CTA.",
  },
];

export const DEFAULT_SECTIONS = [
  "nav",
  "hero",
  "sobre",
  "servicos",
  "diferenciais",
  "contato",
  "footer",
];

export function findOption(list: Option[], value: string): Option | undefined {
  return list.find((o) => o.value === value);
}
export function findGuidance(list: Option[], value: string): string {
  return findOption(list, value)?.guidance ?? "";
}
export function findLabel(list: Option[], value: string): string {
  return findOption(list, value)?.label ?? value;
}
