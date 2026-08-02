import type {
  InstagramClient, InstagramInsights, InstagramMedia, InstagramMediaPage,
} from "../../domain/services/instagram-client.js";

const BASE = "https://graph.instagram.com/v23.0";

/** Metricas pedidas por tipo de midia. Reels tem retencao; imagem/carrossel nao. */
const REEL_METRICS =
  "reach,views,likes,comments,saved,shares,ig_reels_avg_watch_time,ig_reels_video_view_total_time,profile_visits,profile_activity";
const STATIC_METRICS = "reach,views,likes,comments,saved,shares,profile_visits,profile_activity";

interface InsightValue { name: string; values?: Array<{ value: number }>; total_value?: { value: number } }

export class GraphApiInstagramClient implements InstagramClient {
  async fetchMediaPage(token: string, after?: string): Promise<InstagramMediaPage> {
    const url = new URL(`${BASE}/me/media`);
    url.searchParams.set("fields", "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp");
    url.searchParams.set("limit", "25");
    url.searchParams.set("access_token", token);
    if (after) url.searchParams.set("after", after);
    const data = await this.request<{
      data: Array<{ id: string; caption?: string; media_type: string; permalink: string; thumbnail_url?: string; media_url?: string; timestamp: string }>;
      paging?: { cursors?: { after?: string }; next?: string };
    }>(url);
    const media: InstagramMedia[] = data.data.map((m) => ({
      igMediaId: m.id,
      permalink: m.permalink,
      mediaType: m.media_type,
      caption: m.caption ?? null,
      // Videos/reels tem thumbnail_url; imagens usam media_url como preview.
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      publishedAt: new Date(m.timestamp),
    }));
    return { media, nextCursor: data.paging?.next ? (data.paging.cursors?.after ?? null) : null };
  }

  async fetchInsights(token: string, igMediaId: string, mediaType: string): Promise<InstagramInsights> {
    const isReel = mediaType === "REELS" || mediaType === "VIDEO";
    let metrics = isReel ? REEL_METRICS : STATIC_METRICS;
    let rows: InsightValue[];
    try {
      rows = await this.fetchInsightRows(token, igMediaId, metrics);
    } catch (err) {
      // Erro (#100) "metric X not supported": remove a metrica citada e tenta
      // UMA vez de novo -- a disponibilidade varia por conta/midia.
      const unsupported = /metric[s]? \(?([a-z_,\s]+)\)? (is|are) not (supported|available)/i.exec(
        err instanceof Error ? err.message : "",
      );
      if (!unsupported) throw err;
      const bad = unsupported[1]!.split(",").map((s) => s.trim());
      metrics = metrics.split(",").filter((m) => !bad.includes(m)).join(",");
      rows = metrics ? await this.fetchInsightRows(token, igMediaId, metrics) : [];
    }
    const get = (name: string): number | null => {
      const row = rows.find((r) => r.name === name);
      const v = row?.total_value?.value ?? row?.values?.[0]?.value;
      return typeof v === "number" ? v : null;
    };
    return {
      reach: get("reach"),
      views: get("views"),
      // A API devolve avg watch time em ms e total em ms.
      avgWatchTimeMs: get("ig_reels_avg_watch_time"),
      totalWatchTimeMs: get("ig_reels_video_view_total_time"),
      likes: get("likes"),
      comments: get("comments"),
      saved: get("saved"),
      shares: get("shares"),
      profileVisits: get("profile_visits"),
      profileActivity: get("profile_activity"),
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const url = new URL(`${BASE.replace("/v23.0", "")}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", token);
    const data = await this.request<{ access_token: string; expires_in: number }>(url);
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private async fetchInsightRows(token: string, igMediaId: string, metrics: string): Promise<InsightValue[]> {
    const url = new URL(`${BASE}/${igMediaId}/insights`);
    url.searchParams.set("metric", metrics);
    url.searchParams.set("access_token", token);
    const data = await this.request<{ data: InsightValue[] }>(url);
    return data.data;
  }

  /** Fetch com tratamento de erro da Graph API e backoff simples de rate limit. */
  private async request<T>(url: URL, attempt = 0): Promise<T> {
    const res = await fetch(url);
    if (res.status === 429 && attempt < 3) {
      // Rate limit: espera exponencial (2s, 4s, 8s) e re-tenta.
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      return this.request<T>(url, attempt + 1);
    }
    const body = (await res.json()) as T & { error?: { message?: string; code?: number } };
    if (!res.ok || body.error) {
      throw new Error(
        `Instagram Graph API: ${body.error?.message ?? `HTTP ${res.status}`} (code ${body.error?.code ?? res.status})`,
      );
    }
    return body;
  }
}
