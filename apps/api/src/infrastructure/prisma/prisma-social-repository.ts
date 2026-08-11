import { prisma } from "@millead/database";
import type {
  SocialRepository,
  UpsertSocialPostInput,
} from "../../domain/repositories/social-repository.js";
import type {
  SocialConfig,
  SocialFormatSource,
  SocialMetrics,
  SocialMetricSnapshot,
  SocialPost,
  SocialPostFormat,
  SocialPostWithMetrics,
} from "../../domain/entities/social.js";
import { truncateToUtcDay } from "./social-snapshot-day.js";

const SOCIAL_CONFIG_ID = "singleton";

interface SocialPostRow {
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

function toDomainPost(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    igMediaId: row.igMediaId,
    igPermalink: row.igPermalink,
    mediaType: row.mediaType,
    caption: row.caption,
    thumbnailUrl: row.thumbnailUrl,
    publishedAt: row.publishedAt,
    format: row.format,
    formatSource: row.formatSource,
  };
}

interface SocialMetricSnapshotRow {
  id: string;
  postId: string;
  collectedAt: Date;
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: bigint | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

// BigInt no banco (totalWatchTimeMs) -> number na entidade. Feito na fronteira do repo.
function toDomainSnapshot(row: SocialMetricSnapshotRow): SocialMetricSnapshot {
  return {
    id: row.id,
    postId: row.postId,
    collectedAt: row.collectedAt,
    reach: row.reach,
    views: row.views,
    avgWatchTimeMs: row.avgWatchTimeMs,
    totalWatchTimeMs: row.totalWatchTimeMs === null ? null : Number(row.totalWatchTimeMs),
    likes: row.likes,
    comments: row.comments,
    saved: row.saved,
    shares: row.shares,
    profileVisits: row.profileVisits,
    profileActivity: row.profileActivity,
  };
}

// number (entidade) -> BigInt (banco) em totalWatchTimeMs; demais campos passam direto.
function toDb(metrics: SocialMetrics) {
  return {
    reach: metrics.reach,
    views: metrics.views,
    avgWatchTimeMs: metrics.avgWatchTimeMs,
    totalWatchTimeMs: metrics.totalWatchTimeMs === null ? null : BigInt(metrics.totalWatchTimeMs),
    likes: metrics.likes,
    comments: metrics.comments,
    saved: metrics.saved,
    shares: metrics.shares,
    profileVisits: metrics.profileVisits,
    profileActivity: metrics.profileActivity,
  };
}

export class PrismaSocialRepository implements SocialRepository {
  async upsertPost(data: UpsertSocialPostInput): Promise<{ post: SocialPost; created: boolean }> {
    // findUnique antes + upsert depois (2 queries, volume minusculo) so pra saber `created`.
    const existing = await prisma.socialPost.findUnique({ where: { igMediaId: data.igMediaId } });
    const row = await prisma.socialPost.upsert({
      where: { igMediaId: data.igMediaId },
      create: data,
      // NUNCA toca format/formatSource no update -- classificacao e feita a parte.
      update: {
        igPermalink: data.igPermalink,
        mediaType: data.mediaType,
        caption: data.caption,
        thumbnailUrl: data.thumbnailUrl,
        publishedAt: data.publishedAt,
      },
    });
    return { post: toDomainPost(row), created: existing === null };
  }

  async listPosts(): Promise<SocialPostWithMetrics[]> {
    const rows = await prisma.socialPost.findMany({
      orderBy: { publishedAt: "desc" },
      include: { snapshots: { orderBy: { collectedAt: "desc" }, take: 1 } },
    });
    return rows.map((row) => ({
      ...toDomainPost(row),
      latest: row.snapshots[0] ? toDomainSnapshot(row.snapshots[0]) : null,
    }));
  }

  async findPostById(id: string): Promise<SocialPost | null> {
    const row = await prisma.socialPost.findUnique({ where: { id } });
    return row ? toDomainPost(row) : null;
  }

  async listPostsPublishedSince(since: Date): Promise<SocialPost[]> {
    const rows = await prisma.socialPost.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
    });
    return rows.map(toDomainPost);
  }

  async listUnclassified(): Promise<SocialPost[]> {
    const rows = await prisma.socialPost.findMany({
      where: { format: "UNCLASSIFIED" },
      orderBy: { publishedAt: "desc" },
    });
    return rows.map(toDomainPost);
  }

  async setFormat(
    postId: string,
    format: SocialPostFormat,
    source: SocialFormatSource,
  ): Promise<SocialPost | null> {
    const existing = await prisma.socialPost.findUnique({ where: { id: postId } });
    if (!existing) return null;
    const row = await prisma.socialPost.update({
      where: { id: postId },
      data: { format, formatSource: source },
    });
    return toDomainPost(row);
  }

  async addSnapshot(postId: string, collectedAt: Date, metrics: SocialMetrics): Promise<void> {
    // Trunca pro inicio do dia (UTC): torna o sync re-rodavel no mesmo dia sem duplicar.
    const day = truncateToUtcDay(collectedAt);
    await prisma.socialMetricSnapshot.upsert({
      where: { postId_collectedAt: { postId, collectedAt: day } },
      create: { postId, collectedAt: day, ...toDb(metrics) },
      update: toDb(metrics),
    });
  }

  async getSeries(postId: string): Promise<SocialMetricSnapshot[]> {
    const rows = await prisma.socialMetricSnapshot.findMany({
      where: { postId },
      orderBy: { collectedAt: "asc" },
    });
    return rows.map(toDomainSnapshot);
  }

  async getConfig(): Promise<SocialConfig | null> {
    const row = await prisma.socialConfig.findUnique({ where: { id: SOCIAL_CONFIG_ID } });
    return row ? { accessToken: row.accessToken, tokenExpiresAt: row.tokenExpiresAt } : null;
  }

  async saveConfig(accessToken: string, tokenExpiresAt: Date): Promise<void> {
    await prisma.socialConfig.upsert({
      where: { id: SOCIAL_CONFIG_ID },
      create: { id: SOCIAL_CONFIG_ID, accessToken, tokenExpiresAt },
      update: { accessToken, tokenExpiresAt },
    });
  }
}
