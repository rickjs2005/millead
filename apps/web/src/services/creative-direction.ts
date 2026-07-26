import { api } from "./api-client";
import type { CreativeBriefPayload } from "@/features/creative-director/to-brief";
import type { CreativeDirection } from "@/features/creative-director/types";

/**
 * Direção criativa por IA. Stateless: nada é salvo no banco -- a resposta volta
 * pro front, que remonta o dossiê. Sem ANTHROPIC_API_KEY o backend responde 503,
 * por isso a UI checa `GET /api/v1/ai/status` antes de habilitar o botão.
 */
export const creativeDirectionService = {
  direct: (payload: CreativeBriefPayload) =>
    api.post<CreativeDirection>("/api/v1/ai/creative-direction", payload),
};
