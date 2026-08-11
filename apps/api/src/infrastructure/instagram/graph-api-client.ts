import type {
  InstagramClient, InstagramInsights, InstagramMedia, InstagramMediaPage,
} from "../../domain/services/instagram-client.js";
import { AppError } from "../../domain/errors/app-error.js";

const BASE = "https://graph.instagram.com/v23.0";

/** Metricas pedidas por tipo de midia. Reels tem retencao; imagem/carrossel nao. */
const REEL_METRICS =
  "reach,views,likes,comments,saved,shares,ig_reels_avg_watch_time,ig_reels_video_view_total_time";
const STATIC_METRICS = "reach,views,likes,comments,saved,shares,profile_visits,profile_activity";
const SAFE_METRICS = "reach,likes,comments,saved,shares";

interface InsightValue { name: string; values?: Array<{ value: number }>; total_value?: { value: number } }

/**
 * Erro tipado da Graph API, com deteccao por codigo. Estende AppError pra
 * virar 502 (bad gateway) com mensagem clara no errorHandler, em vez de
 * um 500 generico -- a falha e do lado do Instagram, nao da nossa API.
 * `graphCode` guarda o codigo de erro devolvido pela propria Graph API
 * (ex.: 100 = metrica nao suportada); `code` (herdado) e o code do AppError.
 */
class GraphApiError extends AppError {
  readonly statusCode = 502;
  readonly code = "INSTAGRAM_API_ERROR";

  constructor(message: string, public readonly graphCode: number | null) {
    super(message);
  }
}

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
    let nextCursor: string | null = null;
    if (data.paging?.next) {
      nextCursor = data.paging.cursors?.after ?? null;
      if (!nextCursor) {
        try {
          nextCursor = new URL(data.paging.next).searchParams.get("after");
        } catch (err) {
          // URL invalida: encerra a paginacao aqui. Silencioso isso viraria uma
          // primeira carga truncada que parece completa -- entao loga.
          console.warn("[milsocial] paging.next invalido, paginacao encerrada:", err);
        }
      }
    }
    return { media, nextCursor };
  }

  async fetchInsights(token: string, igMediaId: string, mediaType: string): Promise<InstagramInsights> {
    const isReel = mediaType === "REELS" || mediaType === "VIDEO";
    const metrics = isReel ? REEL_METRICS : STATIC_METRICS;
    let rows: InsightValue[];
    try {
      rows = await this.fetchInsightRows(token, igMediaId, metrics);
    } catch (err) {
      // Erro #100 (metrica nao suportada): tentar extrair as metricas citadas e remover;
      // se nao conseguir identificar, retry uma unica vez com conjunto seguro.
      if (err instanceof GraphApiError && err.graphCode === 100) {
        const errMsg = err.message;
        const metricList = metrics.split(",");
        let removedAny = false;
        // Procurar cada metrica da lista atual dentro da mensagem de erro
        const updatedMetrics = metricList.filter((m) => {
          if (errMsg.includes(m)) {
            removedAny = true;
            return false;
          }
          return true;
        }).join(",");

        if (removedAny && updatedMetrics) {
          // Retirou algo e ainda sobrou metrica -- retry com lista reduzida
          rows = await this.fetchInsightRows(token, igMediaId, updatedMetrics);
        } else {
          // Nao conseguiu identificar nada na mensagem -- retry com conjunto seguro
          rows = await this.fetchInsightRows(token, igMediaId, SAFE_METRICS);
        }
      } else {
        throw err;
      }
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

    // Parse seguro de JSON: ler como texto primeiro
    const text = await res.text();
    let body: T & { error?: { message?: string; code?: number } };
    try {
      body = JSON.parse(text) as T & { error?: { message?: string; code?: number } };
    } catch {
      // Resposta nao e JSON (ex: 502/503 HTML de proxy)
      throw new GraphApiError(
        `Instagram Graph API: HTTP ${res.status} (resposta não-JSON)`,
        null,
      );
    }

    if (!res.ok || body.error) {
      const code = body.error?.code ?? res.status;
      const message = body.error?.message ?? `HTTP ${res.status}`;
      throw new GraphApiError(
        `Instagram Graph API: ${message} (code ${code})`,
        typeof code === "number" ? code : null,
      );
    }
    return body;
  }
}
