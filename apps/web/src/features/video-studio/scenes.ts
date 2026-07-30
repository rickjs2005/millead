import type { StudioComponent } from "@millead/video-contracts";
import type { FormScene, StudioZoomTarget } from "./types";

interface StudioSceneInfo {
  label: string;
  zoomTargets: StudioZoomTarget[];
}

/**
 * Catálogo fixo das quatro cenas de ESTÚDIO: elas não dependem do site (são
 * desenhadas em React), então rótulo e alvos de zoom continuam sendo um menu
 * fechado. A cena de SITE deixou de ter catálogo -- ela carrega seu próprio
 * `label` e `zoomTargets` (com caixa), derivados do Snapshot real por
 * `sectionsFromSnapshot`/`zoomCandidatesFor` (ver `from-snapshot.ts`).
 */
export const STUDIO_COMPONENT_INFO: Record<StudioComponent, StudioSceneInfo> = {
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

/** Alvos de zoom de catálogo de uma cena de ESTÚDIO. Vazio para cena de site: ela usa `scene.zoomTargets` direto. */
export function studioZoomTargetsFor(scene: FormScene): StudioZoomTarget[] {
  if (scene.kind !== "studio" || !scene.component) return [];
  return STUDIO_COMPONENT_INFO[scene.component].zoomTargets;
}

/** Rótulo legível de qualquer cena: o `label` real da seção para site, o nome do catálogo para estúdio. */
export function sceneLabel(scene: FormScene): string {
  if (scene.kind === "site") return scene.label ?? scene.sectionId ?? "Cena de site (seção ainda não escolhida)";
  return scene.component ? STUDIO_COMPONENT_INFO[scene.component].label : scene.id;
}
