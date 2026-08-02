import type { SocialPostFormat } from "../entities/social.js";

export interface PostSummaryForAnalysis {
  caption: string | null;
  mediaType: string;
  format: SocialPostFormat;
  publishedAt: Date;
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

export interface SocialAnalysis {
  report: string; // markdown pt-BR
  suggestions: string[]; // proximos conteudos sugeridos
}

export interface SocialAnalyst {
  classifyFormat(caption: string | null, mediaType: string): Promise<SocialPostFormat>;
  analyze(posts: PostSummaryForAnalysis[]): Promise<SocialAnalysis>;
}
