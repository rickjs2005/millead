/**
 * Tipos do diretor criativo. `CreativeInput` é o que o vendedor preenche;
 * `CreativeDirection` é o que a IA devolve (opcional); `Dossier` é o que sai
 * nas 5 abas. O dossiê é montado com ou sem direção -- sem ela, os blocos que
 * exigem invenção viram INSTRUÇÕES pra IA de destino.
 */

export interface CreativeInput {
  // ---- Negócio ----
  businessName: string;
  segment: string;
  description: string;
  audience: string;
  differentials: string;
  location: string;
  contact: string;
  /** Concorrentes diretos (o que a IA não tem como adivinhar). */
  competitors: string;
  /** Faixa de ticket médio -- define nível de argumentação e prova. */
  averageTicket: string;

  // ---- Objetivo e posicionamento ----
  goal: string;
  contentLanguage: string;
  /** Emoção que a página precisa transmitir (value de EMOTIONS). */
  emotion: string;
  /** Arquétipo de marca (value de ARCHETYPES). */
  archetype: string;

  // ---- Sliders 0..4 ----
  /** Acessível ↔ alto padrão. */
  luxury: number;
  /** Seguro ↔ experimental. */
  boldness: number;
  /** Discreta ↔ cinematográfica. */
  motion: number;
  /** Nenhum vídeo ↔ vídeo é a experiência. */
  videoWeight: number;

  // ---- Design ----
  designStyle: string;
  palette: string;
  references: string;

  // ---- Técnico ----
  framework: string;
  language: string;
  animation: string;
  effects: string[];

  // ---- Estrutura ----
  sections: string[];
  notes: string;
}

// ---------------------------------------------------------------------------
// Direção criativa (resposta da IA) -- espelha o json_schema do backend.
// ---------------------------------------------------------------------------

export interface CreativeDirection {
  analise: {
    posicionamento: string;
    tomDeVoz: string;
    dispositivoDominante: string;
    nivelSeo: string;
    objecoes: string[];
  };
  conceito: {
    nome: string;
    ideiaCentral: string;
    metafora: string;
    emocaoAlvo: string;
    porqueFunciona: string;
  };
  narrativa: {
    ato1: string;
    ato2: string;
    ato3: string;
    fioCondutor: string;
  };
  direcaoDeArte: {
    paleta: { hex: string; papel: string }[];
    tipografia: { display: string; texto: string; porque: string };
    texturas: string;
    grid: string;
    luz: string;
  };
  moodboard: {
    categoria: string;
    referencia: string;
    oQueExtrair: string;
  }[];
  wireframe: {
    secao: string;
    objetivo: string;
    objecaoQueResponde: string;
    conteudo: string;
    animacao: string;
    temVideo: boolean;
  }[];
  cenas: {
    ordem: number;
    secaoDoSite: string;
    descricao: string;
    movimentoDeCamera: string;
    plano: string;
    iluminacao: string;
    paletaCinematografica: string;
    duracaoSeg: number;
    integracaoComScroll: string;
    primeiroFrame: string;
    ultimoFrame: string;
  }[];
  stills: {
    uso: string;
    descricao: string;
    camera: string;
    lente: string;
    luz: string;
    composicao: string;
  }[];
  copy: {
    headline: string;
    subheadline: string;
    ctaPrincipal: string;
    ctasSecundarios: string[];
  };
  extras: string[];
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

export interface DossierContext {
  input: CreativeInput;
  /** null = modo grátis (o dossiê instrui a IA de destino a inventar). */
  direction: CreativeDirection | null;
}

/** Uma cena de vídeo com o prompt já formatado pra cada engine. */
export interface VideoScene {
  ordem: number;
  /** Rótulo curto pro card: "Cena 01 · Hero · drone push-in · golden hour". */
  titulo: string;
  secaoDoSite: string;
  integracaoComScroll: string;
  duracaoSeg: number;
  higgsfield: string;
  veo: string;
  runway: string;
}

export interface Dossier {
  /** Aba 1 -- conceito, narrativa, arte, moodboard. */
  concept: string;
  /** Aba 2 -- o prompt que vai inteiro pro Claude Code. */
  codePrompt: string;
  /** Aba 3 -- cenas. `enabled: false` quando videoWeight = 0. */
  video: { enabled: boolean; intro: string; scenes: VideoScene[] };
  /** Aba 4 -- stills pra Midjourney/Flux/Leonardo. */
  images: string;
  /** Aba 5 -- UX, performance, SEO, responsividade, acessibilidade, conversão. */
  checklists: string;
  /** Tudo junto, pro botão "Baixar tudo". */
  full: string;
}
