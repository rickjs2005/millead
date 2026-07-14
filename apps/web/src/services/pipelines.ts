import { api } from "./api-client";
import type { Pipeline, PipelineStage, PipelineWithStages } from "@/types/api";

export const pipelinesService = {
  list: () => api.get<PipelineWithStages[]>("/api/v1/pipelines"),

  get: (id: string) => api.get<PipelineWithStages>(`/api/v1/pipelines/${id}`),

  create: (name: string, isDefault?: boolean) =>
    api.post<Pipeline>("/api/v1/pipelines", { name, isDefault }),

  addStage: (
    pipelineId: string,
    input: { name: string; order: number; color?: string; isWon?: boolean; isLost?: boolean },
  ) => api.post<PipelineStage>(`/api/v1/pipelines/${pipelineId}/stages`, input),
};
