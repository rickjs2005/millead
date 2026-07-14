import type { LandingPageKind } from "@millead/database";

/** Contexto pra geração de uma landing page (dados já filtrados por org). */
export interface LandingPageContext {
  kind: LandingPageKind;
  title: string;
  brief: string | null;
  organizationName: string;
  company: {
    name: string;
    segment: string | null;
    sizeEstimate: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    websites: string[];
    socials: Array<{ platform: string; handleOrUrl: string }>;
    notes: string | null;
  };
  audit: {
    summary: string | null;
    scores: Array<{ category: string; score: number }>;
  } | null;
}

/** Porta do gerador -- a implementação Claude vive em infrastructure/ai. */
export interface LandingPageGenerator {
  /** Devolve um documento HTML completo e autocontido. */
  generate(context: LandingPageContext): Promise<string>;
}
