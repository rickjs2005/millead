import type {
  SocialMetricSnapshot,
  SocialPost,
  SocialPostFormat,
  SocialPostWithMetrics,
} from "../../domain/entities/social.js";
import type { SocialRepository } from "../../domain/repositories/social-repository.js";
import type { InstagramClient } from "../../domain/services/instagram-client.js";
import type {
  PostSummaryForAnalysis,
  SocialAnalysis,
  SocialAnalyst,
} from "../../domain/services/social-analyst.js";
import {
  AiNotConfiguredError,
  NotFoundError,
  SocialNotConfiguredError,
} from "../../domain/errors/app-error.js";

export interface SyncResult {
  postsCreated: number;
  postsUpdated: number;
  snapshotsSaved: number;
  classified: number;
  tokenRefreshed: boolean;
}

export interface FormatComparisonRow {
  format: SocialPostFormat;
  postCount: number;
  avgReach: number | null;
  avgViews: number | null;
  avgWatchTimeMs: number | null;
  avgInteractions: number | null; // media de (likes+comments+saved+shares) por post
  avgProfileVisits: number | null;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

/** Media dos valores nao-null; sem nenhum valor -> null (nunca 0). */
function average(values: Array<number | null | undefined>): number | null {
  const defined = values.filter((v): v is number => v != null);
  if (defined.length === 0) return null;
  return defined.reduce((sum, v) => sum + v, 0) / defined.length;
}

/** Soma likes+comments+saved+shares; todas as 4 null -> null (post fora da media). */
function interactionsOf(latest: SocialMetricSnapshot | null): number | null {
  if (!latest) return null;
  const values = [latest.likes, latest.comments, latest.saved, latest.shares];
  if (values.every((v) => v == null)) return null;
  return values.reduce((sum: number, v) => sum + (v ?? 0), 0);
}

export class SocialService {
  constructor(
    private readonly repo: SocialRepository,
    private readonly instagram: InstagramClient,
    private readonly analyst: SocialAnalyst | null, // null quando ANTHROPIC_API_KEY ausente
    private readonly seedToken: string | undefined, // env.INSTAGRAM_ACCESS_TOKEN
  ) {}

  async sync(): Promise<SyncResult> {
    // 1. Token: config do banco > seed do env. Sem nenhum -> 503.
    const config = await this.repo.getConfig();
    let token = config?.accessToken ?? this.seedToken;
    if (!token) throw new SocialNotConfiguredError();

    // 2. Renovacao: sem config ainda (primeiro sync com seed) OU faltando
    // menos de 10 dias -> refresh e persiste. Falha de refresh no primeiro
    // caso nao aborta (o seed pode ter acabado de ser gerado).
    let tokenRefreshed = false;
    if (!config || config.tokenExpiresAt.getTime() - Date.now() < TEN_DAYS_MS) {
      try {
        const fresh = await this.instagram.refreshToken(token);
        await this.repo.saveConfig(fresh.accessToken, fresh.expiresAt);
        token = fresh.accessToken;
        tokenRefreshed = true;
      } catch {
        if (config) throw new SocialNotConfiguredError(); // token velho E refresh falhou
      }
    }

    // 3. Paginacao com parada incremental: para quando uma pagina INTEIRA
    // ja existia (posts antigos nao mudam de id; primeira carga vai ate o fim).
    let postsCreated = 0;
    let postsUpdated = 0;
    let cursor: string | undefined;
    for (;;) {
      const page = await this.instagram.fetchMediaPage(token, cursor);
      let anyNew = false;
      for (const m of page.media) {
        const { created } = await this.repo.upsertPost({
          igMediaId: m.igMediaId,
          igPermalink: m.permalink,
          mediaType: m.mediaType,
          caption: m.caption,
          thumbnailUrl: m.thumbnailUrl,
          publishedAt: m.publishedAt,
        });
        if (created) {
          postsCreated++;
          anyNew = true;
        } else {
          postsUpdated++;
        }
      }
      if (!page.nextCursor || (!anyNew && page.media.length > 0)) break;
      cursor = page.nextCursor;
    }

    // 4. Insights: so posts dos ultimos 90 dias (mais velhos tem metrica estavel).
    const since = new Date(Date.now() - NINETY_DAYS_MS);
    const active = await this.repo.listPostsPublishedSince(since);
    let snapshotsSaved = 0;
    const now = new Date();
    for (const post of active) {
      const metrics = await this.instagram.fetchInsights(token, post.igMediaId, post.mediaType);
      await this.repo.addSnapshot(post.id, now, metrics);
      snapshotsSaved++;
    }

    // 5. Classificacao IA (best-effort; erro de UM post nao derruba o sync).
    // Nunca reclassifica um post marcado MANUAL (mesmo que o format dele
    // esteja hoje em UNCLASSIFIED por escolha explicita do usuario).
    let classified = 0;
    if (this.analyst) {
      for (const post of await this.repo.listUnclassified()) {
        if (post.formatSource === "MANUAL") continue;
        try {
          const format = await this.analyst.classifyFormat(post.caption, post.mediaType);
          await this.repo.setFormat(post.id, format, "AI");
          classified++;
        } catch {
          /* fica UNCLASSIFIED; proxima sync tenta de novo */
        }
      }
    }

    return { postsCreated, postsUpdated, snapshotsSaved, classified, tokenRefreshed };
  }

  listPosts(): Promise<SocialPostWithMetrics[]> {
    return this.repo.listPosts();
  }

  async getSeries(postId: string): Promise<SocialMetricSnapshot[]> {
    const post = await this.repo.findPostById(postId);
    if (!post) throw new NotFoundError("Post nao encontrado.");
    return this.repo.getSeries(postId);
  }

  async setFormat(postId: string, format: SocialPostFormat): Promise<SocialPost> {
    const updated = await this.repo.setFormat(postId, format, "MANUAL");
    if (!updated) throw new NotFoundError("Post nao encontrado.");
    return updated;
  }

  async getComparison(): Promise<FormatComparisonRow[]> {
    const posts = await this.repo.listPosts();
    const groups = new Map<SocialPostFormat, SocialPostWithMetrics[]>();
    for (const post of posts) {
      const list = groups.get(post.format) ?? [];
      list.push(post);
      groups.set(post.format, list);
    }

    const rows: FormatComparisonRow[] = [];
    for (const [format, group] of groups) {
      rows.push({
        format,
        postCount: group.length,
        avgReach: average(group.map((p) => p.latest?.reach)),
        avgViews: average(group.map((p) => p.latest?.views)),
        avgWatchTimeMs: average(group.map((p) => p.latest?.avgWatchTimeMs)),
        avgInteractions: average(group.map((p) => interactionsOf(p.latest))),
        avgProfileVisits: average(group.map((p) => p.latest?.profileVisits)),
      });
    }
    return rows;
  }

  async generateAnalysis(): Promise<SocialAnalysis> {
    if (!this.analyst) throw new AiNotConfiguredError();

    const posts = await this.repo.listPosts();
    const summaries: PostSummaryForAnalysis[] = posts.map((post) => ({
      caption: post.caption,
      mediaType: post.mediaType,
      format: post.format,
      publishedAt: post.publishedAt,
      reach: post.latest?.reach ?? null,
      views: post.latest?.views ?? null,
      avgWatchTimeMs: post.latest?.avgWatchTimeMs ?? null,
      likes: post.latest?.likes ?? null,
      comments: post.latest?.comments ?? null,
      saved: post.latest?.saved ?? null,
      shares: post.latest?.shares ?? null,
      profileVisits: post.latest?.profileVisits ?? null,
      profileActivity: post.latest?.profileActivity ?? null,
    }));

    return this.analyst.analyze(summaries);
  }
}
