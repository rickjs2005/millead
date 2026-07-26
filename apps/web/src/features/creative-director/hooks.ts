import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/services/api-client";
import { creativeDirectionService } from "@/services/creative-direction";
import { toBrief, type CreativeBriefPayload } from "./to-brief";
import type { CreativeInput } from "./types";

/**
 * Gera a direção criativa. Demora ~1 minuto (thinking + JSON grande), então a
 * UI precisa mostrar estado de progresso -- não é um clique instantâneo.
 */
export function useCreativeDirection() {
  return useMutation({
    mutationFn: (input: CreativeInput) => {
      const payload: CreativeBriefPayload = toBrief(input);
      return creativeDirectionService.direct(payload);
    },
    onError: (err) =>
      toast.error(
        err instanceof ApiError ? err.message : "Erro ao gerar a direção criativa. Tente de novo.",
      ),
  });
}
