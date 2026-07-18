import type { BriefingTemplate, BriefingTemplateDetail } from "../entities/briefing.js";

/**
 * Catálogo GLOBAL de templates (sem organizationId, ver schema.prisma) --
 * populado via seed, somente leitura em runtime nesta fase.
 */
export interface BriefingTemplateRepository {
  /** Lista rasa (sem seções), pra tela "escolher tipo" e "Templates". */
  list(): Promise<BriefingTemplate[]>;
  findById(id: string): Promise<BriefingTemplateDetail | null>;
  findByKey(key: string): Promise<BriefingTemplateDetail | null>;
}
