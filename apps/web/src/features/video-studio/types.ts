import type { SiteSlot, StudioComponent } from "@millead/video-contracts";

export interface ZoomTarget {
  id: string;
  label: string;
}

/** Cena como ela vive no formulário: editável, podendo estar desmarcada. */
export interface FormScene {
  id: string;
  kind: "site" | "studio";
  /** Preenchido quando kind === "site". */
  slot?: SiteSlot;
  /** Preenchido quando kind === "studio". */
  component?: StudioComponent;
  enabled: boolean;
  durationSec: number;
  zoomTargets: string[];
}

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
  narrationMode: NarrationMode;
  narrationText: string;
  customInstructions: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  defaultScenes: FormScene[];
  body: string;
}
