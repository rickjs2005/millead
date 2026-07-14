import { api } from "./api-client";
import type { Tag } from "@/types/api";

export const tagsService = {
  list: () => api.get<Tag[]>("/api/v1/tags"),
  create: (name: string, color?: string) => api.post<Tag>("/api/v1/tags", { name, color }),
};
