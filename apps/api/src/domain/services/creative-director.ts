/**
 * Porta do diretor criativo: recebe o briefing do negócio e devolve a direção
 * criativa estruturada (conceito, narrativa, arte, moodboard, wireframe, cenas
 * de vídeo, stills e copy). Implementada por infrastructure/ai.
 *
 * Nada é persistido -- a direção volta pro front, que monta o dossiê.
 */

export interface CreativeBrief {
  businessName: string;
  segment: string;
  description: string;
  audience: string;
  differentials: string;
  competitors: string;
  averageTicket: string;
  location: string;
  contact: string;
  /** Rótulo legível do objetivo comercial (ex.: "Gerar contato no WhatsApp"). */
  goal: string;
  contentLanguage: string;
  /** Rótulo da emoção-alvo. */
  emotion: string;
  /** Rótulo do arquétipo de marca. */
  archetype: string;
  /** Rótulo do estilo visual, ou "Deixe a direção criativa decidir". */
  designStyle: string;
  palette: string;
  references: string;
  /** Escalas 0..4 já traduzidas em texto pelo front. */
  luxury: string;
  boldness: string;
  motion: string;
  videoWeight: string;
  /** Quantidade de cenas de vídeo desejada (0 = sem vídeo). */
  sceneCount: number;
  /** Rótulos das seções, na ordem escolhida. */
  sections: string[];
  /** Stack escolhida, em texto (framework, linguagem, animação, recursos). */
  stack: string;
  notes: string;
}

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
  narrativa: { ato1: string; ato2: string; ato3: string; fioCondutor: string };
  direcaoDeArte: {
    paleta: { hex: string; papel: string }[];
    tipografia: { display: string; texto: string; porque: string };
    texturas: string;
    grid: string;
    luz: string;
  };
  moodboard: { categoria: string; referencia: string; oQueExtrair: string }[];
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

export interface CreativeDirector {
  direct(brief: CreativeBrief): Promise<CreativeDirection>;
}
