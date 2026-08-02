export interface InstagramMedia {
  igMediaId: string;
  permalink: string;
  mediaType: string; // "REELS" | "IMAGE" | "CAROUSEL_ALBUM" | "VIDEO"
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

export interface InstagramMediaPage {
  media: InstagramMedia[];
  nextCursor: string | null;
}

export interface InstagramInsights {
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

/** Porta pro Instagram -- o token e passado por chamada (a fonte de verdade
 *  do token e o SocialService, que le SocialConfig/env). */
export interface InstagramClient {
  fetchMediaPage(token: string, after?: string): Promise<InstagramMediaPage>;
  fetchInsights(token: string, igMediaId: string, mediaType: string): Promise<InstagramInsights>;
  refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }>;
}
