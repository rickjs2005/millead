export type SocialPostFormat =
  | "UNCLASSIFIED"
  | "REDESIGN"
  | "BEFORE_AFTER"
  | "TIMELAPSE"
  | "REVIEW"
  | "ANIMATION"
  | "CODE_SETUP"
  | "OTHER";
export type SocialFormatSource = "NONE" | "AI" | "MANUAL";

export interface SocialPost {
  id: string;
  igMediaId: string;
  igPermalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  format: SocialPostFormat;
  formatSource: SocialFormatSource;
}

/** Metricas de uma coleta. Todos opcionais: a Graph API nao expoe tudo
 *  pra todo tipo de midia -- null nunca vira zero. */
export interface SocialMetrics {
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null; // BigInt no banco; number na entidade (< 2^53 na pratica)
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

export interface SocialMetricSnapshot extends SocialMetrics {
  id: string;
  postId: string;
  collectedAt: Date;
}

export interface SocialPostWithMetrics extends SocialPost {
  /** Snapshot mais recente, ou null se nunca coletado. */
  latest: SocialMetricSnapshot | null;
}

export interface SocialConfig {
  accessToken: string;
  tokenExpiresAt: Date;
}
