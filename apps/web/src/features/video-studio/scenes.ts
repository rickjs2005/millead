import type { SiteSlot, StudioComponent } from "@millead/video-contracts";
import type { FormScene, ZoomTarget } from "./types";

interface SceneInfo {
  label: string;
  zoomTargets: ZoomTarget[];
}

/**
 * Alvos de zoom são nomes de intenção, não seletores: o crawler ainda não
 * existe. Quando existir, o compilador casa cada nome com um elemento real.
 */
export const SITE_SLOT_INFO: Record<SiteSlot, SceneInfo> = {
  hero: {
    label: "Hero",
    zoomTargets: [
      { id: "titulo", label: "Título" },
      { id: "botao", label: "Botão principal" },
      { id: "imagem", label: "Imagem de fundo" },
    ],
  },
  sobre: {
    label: "Sobre",
    zoomTargets: [
      { id: "texto", label: "Texto" },
      { id: "imagem", label: "Imagem" },
    ],
  },
  servicos: { label: "Serviços", zoomTargets: [{ id: "cards", label: "Cards" }] },
  produtos: {
    label: "Produtos",
    zoomTargets: [
      { id: "cards", label: "Cards" },
      { id: "preco", label: "Preço" },
    ],
  },
  depoimentos: { label: "Depoimentos", zoomTargets: [{ id: "citacao", label: "Citação" }] },
  faq: { label: "FAQ", zoomTargets: [{ id: "pergunta", label: "Pergunta" }] },
  formulario: {
    label: "Formulário",
    zoomTargets: [
      { id: "campos", label: "Campos" },
      { id: "enviar", label: "Botão Enviar" },
    ],
  },
  rodape: { label: "Rodapé", zoomTargets: [{ id: "contato", label: "Contato" }] },
};

export const STUDIO_COMPONENT_INFO: Record<StudioComponent, SceneInfo> = {
  notebook: { label: "Notebook abrindo", zoomTargets: [] },
  google: {
    label: "Busca no Google",
    zoomTargets: [
      { id: "barra", label: "Barra de pesquisa" },
      { id: "resultado", label: "Primeiro resultado" },
      { id: "url", label: "Endereço do site" },
    ],
  },
  whatsapp: {
    label: "Prova no WhatsApp",
    zoomTargets: [
      { id: "conversa", label: "Conversa" },
      { id: "mensagem", label: "Mensagem recebida" },
    ],
  },
  logo: { label: "Logo e CTA", zoomTargets: [] },
};

export function zoomTargetsFor(scene: FormScene): ZoomTarget[] {
  if (scene.kind === "site" && scene.slot) return SITE_SLOT_INFO[scene.slot].zoomTargets;
  if (scene.kind === "studio" && scene.component)
    return STUDIO_COMPONENT_INFO[scene.component].zoomTargets;
  return [];
}

export function sceneLabel(scene: FormScene): string {
  if (scene.kind === "site" && scene.slot) return SITE_SLOT_INFO[scene.slot].label;
  if (scene.kind === "studio" && scene.component)
    return STUDIO_COMPONENT_INFO[scene.component].label;
  return scene.id;
}
