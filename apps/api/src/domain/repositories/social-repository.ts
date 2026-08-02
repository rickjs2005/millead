import type {
  SocialConfig, SocialMetrics, SocialMetricSnapshot,
  SocialPost, SocialPostFormat, SocialFormatSource, SocialPostWithMetrics,
} from "../entities/social.js";

export interface UpsertSocialPostInput {
  igMediaId: string;
  igPermalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

export interface SocialRepository {
  /** Cria ou atualiza (por igMediaId) dados editaveis do post; NUNCA toca format/formatSource. */
  upsertPost(data: UpsertSocialPostInput): Promise<{ post: SocialPost; created: boolean }>;
  listPosts(): Promise<SocialPostWithMetrics[]>;
  findPostById(id: string): Promise<SocialPost | null>;
  /** Posts publicados depois de `since` (corte de 90 dias do sync). */
  listPostsPublishedSince(since: Date): Promise<SocialPost[]>;
  listUnclassified(): Promise<SocialPost[]>;
  setFormat(postId: string, format: SocialPostFormat, source: SocialFormatSource): Promise<SocialPost | null>;
  /** Idempotente por dia: upsert na chave (postId, collectedAt truncado no dia). */
  addSnapshot(postId: string, collectedAt: Date, metrics: SocialMetrics): Promise<void>;
  getSeries(postId: string): Promise<SocialMetricSnapshot[]>;
  getConfig(): Promise<SocialConfig | null>;
  saveConfig(accessToken: string, tokenExpiresAt: Date): Promise<void>;
}
