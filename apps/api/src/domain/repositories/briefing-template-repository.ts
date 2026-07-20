import type { BriefingTemplate, BriefingTemplateDetail } from "../entities/briefing.js";

export interface CreateCustomTemplateInput {
  organizationId: string;
  key: string;
  name: string;
  description?: string | null;
  sections: {
    key: string;
    title: string;
    description?: string | null;
    order: number;
    fields: {
      key: string;
      label: string;
      type: "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "URL" | "SELECT" | "MULTI_SELECT" | "FILE";
      order: number;
      required: boolean;
      helpText?: string | null;
      config?: unknown;
    }[];
  }[];
}

/**
 * Catálogo de templates. Os do seed são globais (organizationId nulo);
 * `createCustom` cria templates kind CUSTOM escopados na organização --
 * um por briefing personalizado, invisíveis no catálogo (`list` filtra).
 */
export interface BriefingTemplateRepository {
  /** Lista rasa (sem seções), pra tela "escolher tipo" e "Templates". Só catálogo global. */
  list(): Promise<BriefingTemplate[]>;
  findById(id: string): Promise<BriefingTemplateDetail | null>;
  /** Escopado: template CUSTOM só é visível pra própria organização
   * (globais do seed são visíveis por todas). */
  findByKey(key: string, organizationId: string): Promise<BriefingTemplateDetail | null>;
  createCustom(input: CreateCustomTemplateInput): Promise<BriefingTemplateDetail>;
}
