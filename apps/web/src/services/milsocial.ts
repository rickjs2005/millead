import { api } from "./api-client";
import type {
  FormatComparisonRow,
  SocialAnalysis,
  SocialMetricSnapshot,
  SocialPostFormat,
  SocialPostWithMetrics,
  SocialSyncResult,
} from "@/types/api";

export const milsocialService = {
  sync: () => api.post<SocialSyncResult>("/api/v1/admin/social/sync", {}),
  listPosts: () => api.get<SocialPostWithMetrics[]>("/api/v1/admin/social/posts"),
  series: (postId: string) =>
    api.get<SocialMetricSnapshot[]>(`/api/v1/admin/social/posts/${postId}/series`),
  setFormat: (postId: string, format: SocialPostFormat) =>
    api.patch<SocialPostWithMetrics>(`/api/v1/admin/social/posts/${postId}/format`, { format }),
  comparison: () => api.get<FormatComparisonRow[]>("/api/v1/admin/social/comparison"),
  analysis: () => api.post<SocialAnalysis>("/api/v1/admin/social/analysis", {}),
};
