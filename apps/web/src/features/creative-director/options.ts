/**
 * Catálogo do diretor criativo. Cada opção carrega um `guidance` -- o texto
 * que entra no dossiê descrevendo aquela escolha pra IA de destino. Estilos
 * trazem `reference` com estúdios/marcas reais, que aparecem na tela e entram
 * no dossiê como inspiração visual.
 */

export interface Option {
  value: string;
  label: string;
  guidance: string;
  /** Exemplos reais de referência (só nos estilos de design). */
  reference?: string;
}

/** Estúdios que definem o padrão de qualidade -- citados no prompt de código. */
export const BENCHMARK_STUDIOS = [
  "Locomotive",
  "Dogstudio",
  "Active Theory",
  "Basic Agency",
  "Resn",
  "AQuest",
  "Fantasy",
  "Build in Amsterdam",
  "Instrument",
  "vencedores do FWA",
  "Awwwards Site of the Day",
];

export const DESIGN_STYLES: Option[] = [
  {
    value: "auto",
    label: "Deixe a direção criativa decidir",
    guidance:
      "escolha a linguagem visual a partir do segmento, do arquétipo e da emoção-alvo; justifique a escolha em uma frase antes de projetar.",
  },
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
      "camadas de vidro fosco translúcido (backdrop-blur), profundidade em camadas, sombras suaves, geralmente sobre fundo escuro com gradientes; o blur comunica hierarquia (o que está à frente x recuado). Só use se o blur tiver função — nada de vidro decorativo.",
    reference: "Apple (macOS/visionOS), Stripe",
  },
  {
    value: "bento",
    label: "Bento grid",
    guidance:
      "grade modular de cards de tamanhos variados (estilo marmita japonesa), cada card é uma micro-história autocontida; quebra o scroll linear e é fácil de escanear.",
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
      "vibe de produto de tecnologia: dark mode, gradientes sutis, cards, badges, seções de features com ícones desenhados sob medida (nunca pacote genérico).",
    reference: "Linear, Stripe, Framer",
  },
  {
    value: "aurora",
    label: "Aurora / Gradientes vibrantes",
    guidance:
      "fundos escuros com gradientes fluidos e luminosos (aurora boreal), brilhos suaves, cores que transitam; o gradiente precisa ser animado por shader ou canvas, não um CSS estático.",
    reference: "Stripe, Linear, Cred",
  },
  {
    value: "institucional",
    label: "Corporativo / Institucional",
    guidance:
      "sério e confiável, estrutura clara, paleta sóbria, foco em credibilidade e prova social; transmite solidez sem cair no genérico de banco.",
    reference: "IBM, Deloitte, Salesforce",
  },
  {
    value: "luxo",
    label: "Luxo / Premium",
    guidance:
      "sofisticado, fontes serifadas de caráter, paleta contida (preto/dourado/cru), muito respiro, fotografia de alto padrão, microinterações discretas e lentas.",
    reference: "Rolex, Aston Martin, Bottega Veneta",
  },
  {
    value: "editorial",
    label: "Editorial / Revista",
    guidance:
      "grid assimétrico, tipografia como protagonista, muito espaço negativo, inspirado em revistas de moda/arquitetura; quebras de coluna propositais.",
    reference: "Kinfolk, Cereal, Bureau Cool",
  },
  {
    value: "brutalismo",
    label: "Brutalismo (soft)",
    guidance:
      "bordas grossas, alto contraste, tipografia crua e grande, layout propositalmente 'sem polimento' -- mas usável, com respiro.",
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
      "cores vibrantes, formas orgânicas, ilustrações autorais, leveza e energia; visual acolhedor e informal.",
    reference: "Mailchimp, Headspace, Slack",
  },
];

export const FRAMEWORKS: Option[] = [
  {
    value: "next-tailwind",
    label: "Next.js 15 (App Router) + React 19 + Tailwind",
    guidance:
      "Next.js 15 com App Router, React 19 e Tailwind; um componente por seção em /components montados em app/page.tsx; next/image, next/font (variable fonts), metadata API pro SEO. Server Components por padrão, 'use client' só onde houver interação.",
  },
  {
    value: "vite-react",
    label: "Vite + React 19 + Tailwind",
    guidance:
      "projeto Vite + React 19 + Tailwind; estrutura leve com um componente por seção e main.tsx montando a página.",
  },
  {
    value: "react-tailwind",
    label: "React + Tailwind (componentes soltos)",
    guidance:
      "componentes React funcionais com Tailwind, um por seção (Hero, Sobre, etc.), prontos pra colar em qualquer projeto.",
  },
  {
    value: "astro-tailwind",
    label: "Astro + Tailwind",
    guidance:
      "Astro com Tailwind; um componente .astro por seção montados em index.astro; ilhas de interatividade só onde precisar (ótimo pra performance extrema).",
  },
  {
    value: "svelte-tailwind",
    label: "SvelteKit + Tailwind",
    guidance:
      "SvelteKit com Tailwind; um componente .svelte por seção, montados em +page.svelte; transições nativas do Svelte onde couber.",
  },
  {
    value: "vue-tailwind",
    label: "Vue 3 + Tailwind",
    guidance: "Vue 3 (script setup) com Tailwind; um componente .vue por seção.",
  },
  {
    value: "html-tailwind",
    label: "HTML + Tailwind (CDN, arquivo único)",
    guidance:
      "um único arquivo HTML usando Tailwind via CDN -- sem build, pronto pra abrir no navegador. Bibliotecas de animação também via CDN.",
  },
  {
    value: "html-css",
    label: "HTML + CSS puro (arquivo único)",
    guidance:
      "um único arquivo HTML com CSS moderno embutido em <style> (sem dependências, sem build). Use CSS nesting, custom properties, clamp() e scroll-driven animations nativas.",
  },
];

export const LANGUAGES: Option[] = [
  {
    value: "typescript",
    label: "TypeScript",
    guidance: "TypeScript com tipagem real nas props e nos dados; nada de `any`.",
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
    guidance:
      "microinterações discretas via CSS (hover, transições suaves com easing customizado), nada exagerado.",
  },
  {
    value: "scroll",
    label: "Revelações no scroll",
    guidance:
      "elementos aparecem com fade/slide/mask ao entrar na viewport (IntersectionObserver ou scroll-driven animations nativas); sempre com easing suave e stagger.",
  },
  {
    value: "gsap",
    label: "GSAP + ScrollTrigger",
    guidance:
      "animações cinematográficas com GSAP + ScrollTrigger (pin, scrub, parallax, timeline no hero); cada animação com propósito narrativo, nunca poluída.",
  },
  {
    value: "framer",
    label: "Motion (Framer Motion)",
    guidance:
      "animações declarativas com Motion (entrada, hover, layout, shared layout, spring physics); suaves e coerentes.",
  },
];

/** Recursos avançados (multi-select). Somados ao dossiê como "além do básico". */
export const EFFECTS: Option[] = [
  {
    value: "three",
    label: "3D com Three.js / R3F",
    guidance:
      "cena 3D interativa com Three.js (ou React Three Fiber, se React/Next) -- objeto 3D no hero ou fundo com geometria animada; leve, com fallback estático em mobile e sem WebGL.",
  },
  {
    value: "shaders",
    label: "Shaders WebGL / distorção",
    guidance:
      "efeitos de shader WebGL (distorção de imagem no hover, gradiente animado por shader, noise/grain); usar com parcimônia e com fallback.",
  },
  {
    value: "smooth-scroll",
    label: "Scroll suave cinematográfico (Lenis)",
    guidance:
      "scroll suave com Lenis, sincronizado às animações de scroll; respeitar prefers-reduced-motion.",
  },
  {
    value: "scroll-driven",
    label: "Scroll-driven animations (CSS nativo)",
    guidance:
      "animações ligadas ao scroll via CSS puro (animation-timeline: scroll()/view()), com fallback JS onde não houver suporte -- performance sem custo de biblioteca.",
  },
  {
    value: "view-transitions",
    label: "View Transitions API",
    guidance:
      "transições de estado e navegação com a View Transitions API (elementos que persistem entre seções/páginas), degradando sem erro onde não houver suporte.",
  },
  {
    value: "spline",
    label: "Spline (3D no-code)",
    guidance: "cena 3D do Spline embutida, com lazy-load e poster estático até carregar.",
  },
  {
    value: "particles",
    label: "Partículas / canvas animado",
    guidance:
      "fundo com partículas ou canvas animado (leve, pausado fora da viewport), reforçando a atmosfera.",
  },
  {
    value: "lottie",
    label: "Lottie (animações After Effects)",
    guidance: "animações vetoriais Lottie em pontos-chave (ícones animados, ilustração no hero).",
  },
  {
    value: "cursor",
    label: "Cursor customizado / magnético",
    guidance:
      "cursor personalizado com efeito magnético nos botões/links (só desktop, com ponteiro fino).",
  },
  {
    value: "parallax",
    label: "Parallax (scroll e mouse)",
    guidance: "camadas em parallax no scroll e no movimento do mouse pra dar profundidade real.",
  },
  {
    value: "mask-reveal",
    label: "Mask reveal / clip-path",
    guidance:
      "revelações por máscara e clip-path animado (texto e imagem surgindo por recorte), com stagger por linha.",
  },
  {
    value: "morph",
    label: "Morph / transformação de forma",
    guidance: "morphing de SVG e transformação de formas entre estados/seções.",
  },
  {
    value: "physics",
    label: "Física / spring",
    guidance: "movimento com física (spring, momentum, inércia no drag), nunca easing linear.",
  },
  {
    value: "marquee",
    label: "Marquee / texto rolante",
    guidance:
      "faixa de texto/logos rolando horizontalmente, com velocidade reagindo ao scroll (não um loop mecânico).",
  },
  {
    value: "fluid-type",
    label: "Tipografia e espaçamento fluidos",
    guidance:
      "escala tipográfica e espaçamento fluidos com clamp() e variable fonts (peso/óptico variando por breakpoint), sem breakpoints duros.",
  },
  {
    value: "container-queries",
    label: "Container queries",
    guidance:
      "componentes que se adaptam ao contêiner e não à viewport (container queries), pra reuso real.",
  },
  {
    value: "themes",
    label: "Dark/light + temas dinâmicos",
    guidance:
      "dark e light mode coerentes (não é inverter cores), via CSS custom properties e color-scheme, respeitando prefers-color-scheme.",
  },
];

export const SECTIONS: Option[] = [
  {
    value: "nav",
    label: "Header / Navegação",
    guidance:
      "cabeçalho com logo e navegação; comportamento no scroll definido (some, encolhe, muda de cor).",
  },
  {
    value: "hero",
    label: "Hero",
    guidance: "abertura da narrativa: promessa central, prova imediata e CTA principal.",
  },
  {
    value: "manifesto",
    label: "Manifesto / Posicionamento",
    guidance:
      "declaração de valor em tipografia grande -- o que a marca defende, em poucas palavras.",
  },
  { value: "sobre", label: "Sobre", guidance: "quem é o negócio e por que confiar nele." },
  {
    value: "servicos",
    label: "Serviços / Produtos",
    guidance: "o que é oferecido, cada item com benefício concreto (não descrição de feature).",
  },
  {
    value: "processo",
    label: "Processo / Como funciona",
    guidance: "as etapas do trabalho -- reduz o medo do desconhecido antes da compra.",
  },
  {
    value: "diferenciais",
    label: "Diferenciais",
    guidance: "por que escolher este negócio e não o concorrente -- 3 a 6 pontos específicos.",
  },
  {
    value: "numeros",
    label: "Números / Resultados",
    guidance: "estatísticas de impacto com contexto (número sozinho não convence).",
  },
  {
    value: "case",
    label: "Case / Antes e depois",
    guidance: "um caso real destrinchado: situação, o que foi feito, resultado.",
  },
  {
    value: "depoimentos",
    label: "Depoimentos",
    guidance: "prova social com depoimentos específicos; nunca inventar nome de pessoa real.",
  },
  {
    value: "galeria",
    label: "Galeria / Portfólio",
    guidance: "trabalhos ou produtos em grade com tratamento visual autoral.",
  },
  {
    value: "precos",
    label: "Planos / Preços",
    guidance: "planos ou faixa de preço com CTA em cada e o plano recomendado em destaque.",
  },
  {
    value: "faq",
    label: "FAQ",
    guidance: "perguntas frequentes -- cada uma derruba uma objeção real.",
  },
  {
    value: "cta",
    label: "CTA final",
    guidance: "chamada final forte, tela limpa, uma única ação.",
  },
  {
    value: "contato",
    label: "Contato / Formulário",
    guidance: "formulário curto e/ou botão de WhatsApp com mensagem pré-preenchida.",
  },
  { value: "mapa", label: "Mapa / Localização", guidance: "endereço e mapa embutido (lazy)." },
  { value: "footer", label: "Footer", guidance: "rodapé com contato, redes sociais e copyright." },
];

export const GOALS: Option[] = [
  {
    value: "whatsapp",
    label: "Gerar contato no WhatsApp",
    guidance:
      "converter o visitante em uma conversa no WhatsApp; botões bem visíveis, com mensagem pré-preenchida.",
  },
  {
    value: "lead",
    label: "Capturar leads (formulário)",
    guidance: "capturar dados do visitante num formulário curto e objetivo.",
  },
  {
    value: "venda",
    label: "Vender um produto/serviço",
    guidance: "levar à compra; oferta, benefícios e prova social com CTA de compra.",
  },
  {
    value: "agendamento",
    label: "Agendar reunião/consulta",
    guidance: "levar o visitante a agendar um horário; CTA de agendamento em destaque.",
  },
  {
    value: "institucional",
    label: "Apresentar a empresa",
    guidance: "passar credibilidade e apresentar a empresa, com contato ao fim.",
  },
  {
    value: "evento",
    label: "Divulgar um evento",
    guidance: "divulgar um evento com data, local e inscrição/CTA.",
  },
];

/** Emoção que a página precisa provocar -- guia paleta, ritmo e copy. */
export const EMOTIONS: Option[] = [
  {
    value: "confianca",
    label: "Confiança",
    guidance:
      "o visitante precisa sentir segurança: ritmo calmo, provas concretas, nada de urgência artificial.",
  },
  {
    value: "desejo",
    label: "Desejo",
    guidance:
      "o visitante precisa querer aquilo: imagem grande, textura, luz sobre o produto, poucas palavras.",
  },
  {
    value: "urgencia",
    label: "Urgência",
    guidance:
      "o visitante precisa agir agora: ritmo acelerado, contraste alto, CTA repetido -- sem contagem regressiva falsa.",
  },
  {
    value: "pertencimento",
    label: "Pertencimento",
    guidance: "o visitante precisa se ver ali: rostos, comunidade, linguagem de 'nós'.",
  },
  {
    value: "curiosidade",
    label: "Curiosidade",
    guidance:
      "o visitante precisa querer descer: revelações graduais, informação que se completa no scroll.",
  },
  {
    value: "calma",
    label: "Calma",
    guidance: "o visitante precisa relaxar: muito respiro, movimento lento, paleta dessaturada.",
  },
  {
    value: "poder",
    label: "Poder / Autoridade",
    guidance: "o visitante precisa sentir força: escala, contraste, tipografia pesada, preto.",
  },
  {
    value: "nostalgia",
    label: "Nostalgia",
    guidance: "o visitante precisa lembrar: grão, cor analógica, tipografia de época.",
  },
];

/** Arquétipos de marca -- definem voz, ritmo e vocabulário visual. */
export const ARCHETYPES: Option[] = [
  {
    value: "criador",
    label: "O Criador",
    guidance: "inovação e expressão; visual autoral, experimental.",
  },
  {
    value: "sabio",
    label: "O Sábio",
    guidance: "conhecimento e verdade; visual sóbrio, dados, clareza.",
  },
  {
    value: "heroi",
    label: "O Herói",
    guidance: "coragem e superação; escala, contraste, movimento decidido.",
  },
  {
    value: "fora-da-lei",
    label: "O Fora da Lei",
    guidance: "ruptura; quebra de grid, alto contraste, tom provocador.",
  },
  {
    value: "mago",
    label: "O Mago",
    guidance: "transformação; efeitos, revelações, sensação de mágica.",
  },
  {
    value: "explorador",
    label: "O Explorador",
    guidance: "liberdade e descoberta; paisagem, horizonte, movimento amplo.",
  },
  {
    value: "inocente",
    label: "O Inocente",
    guidance: "simplicidade e otimismo; claro, limpo, leve.",
  },
  {
    value: "cara-comum",
    label: "O Cara Comum",
    guidance: "pertencimento e honestidade; direto, sem pompa, gente real.",
  },
  {
    value: "amante",
    label: "O Amante",
    guidance: "beleza e intimidade; luz quente, close, sensorial.",
  },
  { value: "bobo", label: "O Bobo", guidance: "diversão; cor, movimento inesperado, humor." },
  {
    value: "cuidador",
    label: "O Cuidador",
    guidance: "acolhimento; formas suaves, tom próximo, calor.",
  },
  {
    value: "governante",
    label: "O Governante",
    guidance: "controle e excelência; simetria, materiais nobres, contenção.",
  },
];

// ---------------------------------------------------------------------------
// Escalas (sliders 0..4)
// ---------------------------------------------------------------------------

export interface Scale {
  key: "luxury" | "boldness" | "motion" | "videoWeight";
  label: string;
  min: string;
  max: string;
  /** Um texto por nível -- entra no dossiê. */
  levels: string[];
}

export const SCALES: Scale[] = [
  {
    key: "luxury",
    label: "Nível de luxo",
    min: "acessível",
    max: "alto padrão",
    levels: [
      "popular e direto: preço visível, linguagem simples, prova social por volume.",
      "acessível com cuidado: bom acabamento, sem ostentação.",
      "profissional: acabamento consistente, materiais visuais de qualidade.",
      "premium: respiro generoso, fotografia dirigida, microinterações discretas.",
      "alto padrão: contenção máxima, materiais nobres, nada de preço na primeira dobra.",
    ],
  },
  {
    key: "boldness",
    label: "Ousadia criativa",
    min: "seguro",
    max: "experimental",
    levels: [
      "convencional e previsível por escolha: o negócio exige familiaridade acima de originalidade.",
      "familiar com um detalhe autoral que diferencia.",
      "equilibrado: estrutura reconhecível com execução claramente autoral.",
      "ousado: quebra de grid, navegação não linear, decisões que chamam atenção.",
      "experimental: a interface é a mensagem; pode desafiar convenções desde que continue usável.",
    ],
  },
  {
    key: "motion",
    label: "Densidade de animação",
    min: "discreta",
    max: "cinematográfica",
    levels: [
      "estático: sem movimento além do necessário.",
      "discreto: hover e transições de estado.",
      "presente: revelações no scroll com stagger e easing autoral.",
      "coreografado: timeline por seção, pin e scrub, parallax em camadas.",
      "cinematográfico: a página é uma sequência dirigida; o scroll é a linha do tempo.",
    ],
  },
  {
    key: "videoWeight",
    label: "Peso do vídeo",
    min: "nenhum",
    max: "é a experiência",
    levels: [
      "sem vídeo.",
      "um vídeo curto de apoio em uma seção.",
      "vídeo no hero + um vídeo de apoio, integrados ao scroll.",
      "vídeo conduz a narrativa: hero, transições entre seções e revelações.",
      "o vídeo é a experiência: o scroll controla a linha do tempo do filme de ponta a ponta.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Vocabulário de direção de fotografia/filmagem (entra nos prompts de vídeo)
// ---------------------------------------------------------------------------

export const CAMERA_MOVES = [
  "push in",
  "pull out",
  "dolly",
  "tracking shot",
  "orbit",
  "crane",
  "drone",
  "handheld",
  "steadicam",
  "slider",
  "whip pan",
  "tilt",
  "rack focus",
  "zoom progressivo",
  "câmera estática",
];

export const SHOT_TYPES = [
  "extreme wide",
  "wide",
  "medium",
  "close-up",
  "extreme close-up",
  "macro",
  "over the shoulder",
  "POV",
  "top-down",
  "low angle",
  "dutch angle",
];

export const LIGHTING = [
  "golden hour",
  "blue hour",
  "luz natural difusa",
  "luz dura direcional",
  "soft shadows",
  "volumetric light",
  "backlight / contraluz",
  "rim light",
  "practical lights",
  "neon",
  "luz de janela",
  "high key",
  "low key",
];

export const VIDEO_TECHNIQUES = [
  "slow motion",
  "timelapse",
  "hyperlapse",
  "loop perfeito",
  "scroll sync",
  "mouse sync",
  "parallax video",
  "background video",
  "scroll reveal",
  "lens flare",
];

// ---------------------------------------------------------------------------
// Listas negras -- entram no prompt como proibições explícitas.
// ---------------------------------------------------------------------------

export const VISUAL_BANLIST = [
  "cards retangulares idênticos em grade 3x3",
  "hero centralizado com título, subtítulo e dois botões",
  "grid de 12 colunas usado de forma previsível do topo ao rodapé",
  "botões pill com gradiente roxo/azul",
  "glassmorphism sem função (vidro decorativo)",
  "gradientes exagerados cobrindo seções inteiras",
  "ícones de pacote genérico (Font Awesome, Material padrão) sem tratamento",
  "ilustrações estilo Corporate Memphis / undraw",
  "seções que repetem a mesma estrutura visual uma após a outra",
  "fontes de sistema como escolha tipográfica principal (Inter, Roboto, Arial)",
  "sombra difusa padrão do Tailwind em tudo",
  "layout que poderia ser de qualquer outro negócio se trocasse o logo",
];

export const COPY_BANLIST = [
  "inovação",
  "excelência",
  "soluções completas",
  "soluções personalizadas",
  "transformando sonhos em realidade",
  "sua melhor escolha",
  "qualidade e compromisso",
  "líder de mercado",
  "atendimento diferenciado",
  "pensando em você",
  "venha nos conhecer",
  "não perca tempo",
  "lorem ipsum",
];

export const DEFAULT_SECTIONS = [
  "nav",
  "hero",
  "sobre",
  "servicos",
  "diferenciais",
  "depoimentos",
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
/** Texto do nível de um slider, com clamp defensivo. */
export function scaleLevel(scale: Scale, value: number): string {
  const i = Math.min(Math.max(Math.round(value), 0), scale.levels.length - 1);
  return scale.levels[i]!;
}
