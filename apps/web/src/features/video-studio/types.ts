import type { StudioComponent, ZoomTarget } from "@millead/video-contracts";

/**
 * Alvo de zoom de uma cena de ESTÚDIO: catálogo fixo de ids/rótulos (o
 * componente é desenhado em React, não capturado do site, então não tem
 * caixa medida). Não confundir com `ZoomTarget` de `@millead/video-contracts`,
 * que carrega a caixa medida pelo crawler e vale só para cenas de site.
 */
export interface StudioZoomTarget {
  id: string;
  label: string;
}

/** Cena de site como ela vive no formulário: aponta para a seção REAL de um Snapshot. */
export interface SiteFormScene {
  id: string;
  kind: "site";
  enabled: boolean;
  durationSec: number;
  /** Id real da seção casada pelo `matchTemplate` ("raio-x", "contact"...). Ausente até casar. */
  sectionId?: string;
  /** Rótulo legível da seção, para exibir no formulário. */
  label?: string;
  /** Caminho da miniatura, quando a captura trouxe. */
  screenshot?: string | null;
  /** nodeId do Snapshot de onde a seção veio -- rastreia a origem até a captura. */
  sourceNodeId?: string;
  zoomTargets: ZoomTarget[];
}

/** Cena de estúdio: não depende do site, sempre um dos quatro componentes fixos. */
export interface StudioFormScene {
  id: string;
  kind: "studio";
  component?: StudioComponent;
  enabled: boolean;
  durationSec: number;
  zoomTargets: string[];
}

export type FormScene = SiteFormScene | StudioFormScene;

export type VideoFormat = "9:16" | "16:9" | "1:1";
export type NarrationMode = "auto" | "manual" | "custom";
export type TotalDuration = 15 | 30 | 45 | 60;

/** ids dos cinco templates declarados em TEMPLATES (templates.ts). */
export type TemplateId = "institucional" | "lancamento" | "portfolio" | "loja" | "captacao";

export interface VideoStudioForm {
  businessName: string;
  url: string;
  segment: string;
  templateId: string;
  totalDurationSec: TotalDuration;
  format: VideoFormat;
  scenes: FormScene[];
  /** Id do Snapshot carregado do crawler -- obrigatório se houver cena de site. */
  snapshotId?: string;
  narrationMode: NarrationMode;
  narrationText: string;
  customInstructions: string;
}

/**
 * Um pedido de cena de site: o template não sabe mais quais seções o site
 * TEM, só o que gostaria de mostrar. `matchTemplate` casa cada `want` com a
 * primeira seção real (ainda não usada) cujo id ou rótulo contenha alguma
 * das `palavras` -- e relata em `naoEncontrados` o que não achou.
 */
export interface SceneWant {
  /** Rótulo curto do que se busca ("Hero", "Depoimentos"...), usado no relatório de não encontrados. */
  chave: string;
  /** Palavras-chave em minúsculas e sem acento, casadas por substring contra sectionId/label. */
  palavras: string[];
  durationSec: number;
}

export interface PromptTemplate {
  id: TemplateId;
  name: string;
  description: string;
  /** Só cenas de ESTÚDIO -- elas não dependem do site, então o template já sabe quais são. */
  defaultScenes: StudioFormScene[];
  /**
   * Quantas cenas de `defaultScenes`, na ordem em que aparecem, vêm ANTES do
   * bloco de cenas de site casadas pelos `wants` (o restante vem depois).
   * Ex.: notebook + Google abrindo, WhatsApp fechando -> siteInsertAt = 2.
   */
  siteInsertAt: number;
  /** O que o template pede que o site tenha -- sugestão, não catálogo fechado. */
  wants: SceneWant[];
  body: string;
}
