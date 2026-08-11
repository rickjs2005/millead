import { describe, expect, it, vi } from "vitest";
import type {
  SocialConfig,
  SocialMetricSnapshot,
  SocialMetrics,
  SocialPost,
  SocialPostFormat,
  SocialFormatSource,
} from "../../domain/entities/social.js";
import type {
  UpsertSocialPostInput,
  SocialRepository,
} from "../../domain/repositories/social-repository.js";
import type {
  InstagramClient,
  InstagramInsights,
  InstagramMedia,
  InstagramMediaPage,
} from "../../domain/services/instagram-client.js";
import type { SocialAnalyst } from "../../domain/services/social-analyst.js";
import {
  AiNotConfiguredError,
  NotFoundError,
  SocialNotConfiguredError,
} from "../../domain/errors/app-error.js";
import { SocialService } from "./social-service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers / fakes in-memory (sem Prisma)
// ---------------------------------------------------------------------------

function fakePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: overrides.id ?? "post-1",
    igMediaId: overrides.igMediaId ?? "ig-1",
    igPermalink: "https://instagram.com/p/ig-1",
    mediaType: "IMAGE",
    caption: "legenda",
    thumbnailUrl: null,
    publishedAt: new Date(),
    format: "UNCLASSIFIED",
    formatSource: "NONE",
    ...overrides,
  };
}

function emptyMetrics(overrides: Partial<SocialMetrics> = {}): SocialMetrics {
  return {
    reach: null,
    views: null,
    avgWatchTimeMs: null,
    totalWatchTimeMs: null,
    likes: null,
    comments: null,
    saved: null,
    shares: null,
    profileVisits: null,
    profileActivity: null,
    ...overrides,
  };
}

interface FakeRepo extends SocialRepository {
  __posts: Map<string, SocialPost>; // por id
  __snapshots: Map<string, SocialMetricSnapshot[]>; // por postId
}

function makeRepo(
  options: {
    posts?: SocialPost[];
    config?: SocialConfig | null;
  } = {},
): FakeRepo {
  const postsById = new Map<string, SocialPost>();
  const postsByIgId = new Map<string, string>(); // igMediaId -> id
  const snapshots = new Map<string, SocialMetricSnapshot[]>();
  let config: SocialConfig | null = options.config ?? null;
  let nextId = 1;

  for (const p of options.posts ?? []) {
    postsById.set(p.id, p);
    postsByIgId.set(p.igMediaId, p.id);
  }

  function latestSnapshot(postId: string): SocialMetricSnapshot | null {
    const list = snapshots.get(postId) ?? [];
    return list.length > 0 ? (list[list.length - 1] ?? null) : null;
  }

  const repo: FakeRepo = {
    __posts: postsById,
    __snapshots: snapshots,

    async upsertPost(data: UpsertSocialPostInput) {
      const existingId = postsByIgId.get(data.igMediaId);
      if (existingId) {
        const existing = postsById.get(existingId)!;
        const updated: SocialPost = {
          ...existing,
          igPermalink: data.igPermalink,
          mediaType: data.mediaType,
          caption: data.caption,
          thumbnailUrl: data.thumbnailUrl,
          publishedAt: data.publishedAt,
        };
        postsById.set(existingId, updated);
        return { post: updated, created: false };
      }
      const id = `post-auto-${nextId++}`;
      const post: SocialPost = {
        id,
        igMediaId: data.igMediaId,
        igPermalink: data.igPermalink,
        mediaType: data.mediaType,
        caption: data.caption,
        thumbnailUrl: data.thumbnailUrl,
        publishedAt: data.publishedAt,
        format: "UNCLASSIFIED",
        formatSource: "NONE",
      };
      postsById.set(id, post);
      postsByIgId.set(data.igMediaId, id);
      return { post, created: true };
    },

    async listPosts() {
      return [...postsById.values()].map((post) => ({
        ...post,
        latest: latestSnapshot(post.id),
      }));
    },

    async findPostById(id: string) {
      return postsById.get(id) ?? null;
    },

    async listPostsPublishedSince(since: Date) {
      return [...postsById.values()].filter((p) => p.publishedAt.getTime() > since.getTime());
    },

    async listUnclassified() {
      return [...postsById.values()].filter((p) => p.format === "UNCLASSIFIED");
    },

    async setFormat(postId: string, format: SocialPostFormat, source: SocialFormatSource) {
      const post = postsById.get(postId);
      if (!post) return null;
      const updated: SocialPost = { ...post, format, formatSource: source };
      postsById.set(postId, updated);
      return updated;
    },

    async addSnapshot(postId: string, collectedAt: Date, metrics: SocialMetrics) {
      const list = snapshots.get(postId) ?? [];
      list.push({ id: `snap-${postId}-${list.length + 1}`, postId, collectedAt, ...metrics });
      snapshots.set(postId, list);
    },

    async getSeries(postId: string) {
      return snapshots.get(postId) ?? [];
    },

    async getConfig() {
      return config;
    },

    async saveConfig(accessToken: string, tokenExpiresAt: Date) {
      config = { accessToken, tokenExpiresAt };
    },
  };

  return repo;
}

interface FakeInstagram extends InstagramClient {
  __fetchMediaPageCalls: Array<string | undefined>;
  __fetchInsightsCalls: string[];
  __refreshTokenCalls: string[];
}

function makeInstagram(
  pages: InstagramMediaPage[],
  options: {
    insightsByIgMediaId?: Record<string, InstagramInsights>;
    /** igMediaIds cujo fetchInsights deve lancar (simula erro da Graph API). */
    failInsightsFor?: string[];
    refreshToken?: () => Promise<{ accessToken: string; expiresAt: Date }>;
  } = {},
): FakeInstagram {
  const fetchMediaPageCalls: Array<string | undefined> = [];
  const fetchInsightsCalls: string[] = [];
  const refreshTokenCalls: string[] = [];
  let pageIndex = 0;

  return {
    __fetchMediaPageCalls: fetchMediaPageCalls,
    __fetchInsightsCalls: fetchInsightsCalls,
    __refreshTokenCalls: refreshTokenCalls,

    async fetchMediaPage(_token: string, after?: string) {
      fetchMediaPageCalls.push(after);
      const page = pages[pageIndex] ?? { media: [], nextCursor: null };
      pageIndex++;
      return page;
    },

    async fetchInsights(_token: string, igMediaId: string) {
      fetchInsightsCalls.push(igMediaId);
      if (options.failInsightsFor?.includes(igMediaId)) {
        throw new Error(`Instagram Graph API: falha simulada em ${igMediaId}`);
      }
      return options.insightsByIgMediaId?.[igMediaId] ?? emptyMetrics({ reach: 100, likes: 10 });
    },

    async refreshToken(token: string) {
      refreshTokenCalls.push(token);
      if (options.refreshToken) return options.refreshToken();
      return { accessToken: `${token}-fresh`, expiresAt: new Date(Date.now() + 60 * DAY_MS) };
    },
  };
}

function makeAnalyst(overrides: Partial<SocialAnalyst> = {}): SocialAnalyst {
  return {
    classifyFormat: vi.fn(async () => "REDESIGN" as SocialPostFormat),
    analyze: vi.fn(async () => ({ report: "relatorio", suggestions: [] })),
    ...overrides,
  };
}

function media(overrides: Partial<InstagramMedia> = {}): InstagramMedia {
  return {
    igMediaId: "ig-1",
    permalink: "https://instagram.com/p/ig-1",
    mediaType: "IMAGE",
    caption: "legenda",
    thumbnailUrl: null,
    publishedAt: new Date(),
    ...overrides,
  };
}

const farFutureConfig: SocialConfig = {
  accessToken: "token-valido",
  tokenExpiresAt: new Date(Date.now() + 60 * DAY_MS),
};

// ---------------------------------------------------------------------------
// sync()
// ---------------------------------------------------------------------------

describe("SocialService.sync", () => {
  it("sem token configurado (nem config nem seed) lanca SocialNotConfiguredError", async () => {
    const repo = makeRepo({ config: null });
    const instagram = makeInstagram([]);
    const service = new SocialService(repo, instagram, makeAnalyst(), undefined);

    await expect(service.sync()).rejects.toThrow(SocialNotConfiguredError);
  });

  it("primeira carga: pagina ate o fim e cria todos os posts", async () => {
    const repo = makeRepo({ config: null });
    const page1: InstagramMediaPage = {
      media: [media({ igMediaId: "ig-1" }), media({ igMediaId: "ig-2" })],
      nextCursor: "cursor-2",
    };
    const page2: InstagramMediaPage = {
      media: [media({ igMediaId: "ig-3" }), media({ igMediaId: "ig-4" })],
      nextCursor: null,
    };
    const instagram = makeInstagram([page1, page2]);
    const service = new SocialService(repo, instagram, null, "seed-token");

    const result = await service.sync();

    expect(result.postsCreated).toBe(4);
    expect(instagram.__fetchMediaPageCalls.length).toBe(2);
  });

  it("incremental: para de paginar quando a pagina inteira ja existe", async () => {
    const existing1 = fakePost({ id: "post-1", igMediaId: "ig-1" });
    const existing2 = fakePost({ id: "post-2", igMediaId: "ig-2" });
    const repo = makeRepo({ posts: [existing1, existing2], config: farFutureConfig });
    const page1: InstagramMediaPage = {
      media: [media({ igMediaId: "ig-1" }), media({ igMediaId: "ig-2" })],
      nextCursor: "cursor-2", // deve ser ignorado
    };
    const instagram = makeInstagram([page1]);
    const service = new SocialService(repo, instagram, null, undefined);

    const result = await service.sync();

    expect(result.postsCreated).toBe(0);
    expect(result.postsUpdated).toBe(2);
    expect(instagram.__fetchMediaPageCalls.length).toBe(1);
  });

  it("coleta insights so de posts publicados nos ultimos 90 dias", async () => {
    const recent = fakePost({
      id: "post-recent",
      igMediaId: "ig-recent",
      publishedAt: new Date(Date.now() - 1 * DAY_MS),
    });
    const old = fakePost({
      id: "post-old",
      igMediaId: "ig-old",
      publishedAt: new Date(Date.now() - 120 * DAY_MS),
    });
    const repo = makeRepo({ posts: [recent, old], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const service = new SocialService(repo, instagram, null, undefined);

    await service.sync();

    expect(instagram.__fetchInsightsCalls).toEqual(["ig-recent"]);
  });

  it("grava snapshot com metricas null preservadas (nao vira zero)", async () => {
    const post = fakePost({
      id: "post-1",
      igMediaId: "ig-1",
      publishedAt: new Date(Date.now() - 1 * DAY_MS),
    });
    const repo = makeRepo({ posts: [post], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }], {
      insightsByIgMediaId: {
        "ig-1": emptyMetrics({ reach: 500 }), // views, likes etc continuam null
      },
    });
    const service = new SocialService(repo, instagram, null, undefined);

    await service.sync();

    const snaps = repo.__snapshots.get("post-1")!;
    expect(snaps).toHaveLength(1);
    const [snap] = snaps;
    expect(snap!.reach).toBe(500);
    expect(snap!.views).toBeNull();
    expect(snap!.likes).toBeNull();
  });

  it("classifica posts UNCLASSIFIED e grava formatSource AI", async () => {
    const post = fakePost({
      id: "post-1",
      igMediaId: "ig-1",
      format: "UNCLASSIFIED",
      formatSource: "NONE",
    });
    const repo = makeRepo({ posts: [post], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const analyst = makeAnalyst();
    const service = new SocialService(repo, instagram, analyst, undefined);

    const result = await service.sync();

    expect(result.classified).toBe(1);
    const updated = repo.__posts.get("post-1")!;
    expect(updated.format).toBe("REDESIGN");
    expect(updated.formatSource).toBe("AI");
  });

  it("nao reclassifica post com formatSource MANUAL", async () => {
    const post = fakePost({
      id: "post-1",
      igMediaId: "ig-1",
      format: "UNCLASSIFIED",
      formatSource: "MANUAL",
    });
    const repo = makeRepo({ posts: [post], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const analyst = makeAnalyst();
    const service = new SocialService(repo, instagram, analyst, undefined);

    const result = await service.sync();

    expect(result.classified).toBe(0);
    expect(analyst.classifyFormat).not.toHaveBeenCalled();
    const unchanged = repo.__posts.get("post-1")!;
    expect(unchanged.format).toBe("UNCLASSIFIED");
    expect(unchanged.formatSource).toBe("MANUAL");
  });

  it("analyst null: sync completa sem classificar (classified = 0)", async () => {
    const post = fakePost({ id: "post-1", igMediaId: "ig-1", format: "UNCLASSIFIED" });
    const repo = makeRepo({ posts: [post], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const service = new SocialService(repo, instagram, null, undefined);

    const result = await service.sync();

    expect(result.classified).toBe(0);
  });

  it("erro de insights num post: conta em insightsFailed, loga, e nao aborta o sync", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const ok = fakePost({
      id: "post-ok",
      igMediaId: "ig-ok",
      publishedAt: new Date(Date.now() - 1 * DAY_MS),
    });
    const broken = fakePost({
      id: "post-broken",
      igMediaId: "ig-broken",
      publishedAt: new Date(Date.now() - 1 * DAY_MS),
    });
    const repo = makeRepo({ posts: [ok, broken], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }], {
      failInsightsFor: ["ig-broken"],
    });
    const service = new SocialService(repo, instagram, null, undefined);

    const result = await service.sync();

    expect(result.snapshotsSaved).toBe(1);
    expect(result.insightsFailed).toBe(1);
    // O post que falhou nao pode ter snapshot; o outro tem.
    expect(repo.__snapshots.get("post-broken")).toBeUndefined();
    expect(repo.__snapshots.get("post-ok")).toHaveLength(1);
    // O erro precisa aparecer em algum lugar -- antes era engolido por um catch vazio.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ig-broken");
    warn.mockRestore();
  });

  it("erro de classificacao: conta em classificationFailed, loga, e nao aborta o sync", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const post = fakePost({ id: "post-1", igMediaId: "ig-1", format: "UNCLASSIFIED" });
    const repo = makeRepo({ posts: [post], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const analyst = makeAnalyst({
      classifyFormat: vi.fn(async () => {
        throw new Error("IA indisponivel");
      }),
    });
    const service = new SocialService(repo, instagram, analyst, undefined);

    const result = await service.sync();

    expect(result.classified).toBe(0);
    expect(result.classificationFailed).toBe(1);
    expect(repo.__posts.get("post-1")!.format).toBe("UNCLASSIFIED");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("post-1");
    warn.mockRestore();
  });

  it("sync sem falhas zera os dois contadores de erro", async () => {
    const post = fakePost({
      id: "post-1",
      igMediaId: "ig-1",
      publishedAt: new Date(Date.now() - 1 * DAY_MS),
    });
    const repo = makeRepo({ posts: [post], config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const service = new SocialService(repo, instagram, makeAnalyst(), undefined);

    const result = await service.sync();

    expect(result.insightsFailed).toBe(0);
    expect(result.classificationFailed).toBe(0);
  });

  it("renova token quando faltam menos de 10 dias e persiste no config", async () => {
    const nearExpiryConfig: SocialConfig = {
      accessToken: "token-velho",
      tokenExpiresAt: new Date(Date.now() + 5 * DAY_MS),
    };
    const repo = makeRepo({ config: nearExpiryConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const service = new SocialService(repo, instagram, null, undefined);

    const result = await service.sync();

    expect(result.tokenRefreshed).toBe(true);
    expect(instagram.__refreshTokenCalls).toEqual(["token-velho"]);
    const savedConfig = await repo.getConfig();
    expect(savedConfig?.accessToken).toBe("token-velho-fresh");
  });

  it("nao renova token quando faltam mais de 10 dias", async () => {
    const repo = makeRepo({ config: farFutureConfig });
    const instagram = makeInstagram([{ media: [], nextCursor: null }]);
    const service = new SocialService(repo, instagram, null, undefined);

    const result = await service.sync();

    expect(result.tokenRefreshed).toBe(false);
    expect(instagram.__refreshTokenCalls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getComparison()
// ---------------------------------------------------------------------------

describe("SocialService.getComparison", () => {
  it("agrupa por formato e calcula medias ignorando nulls", async () => {
    const postA = fakePost({ id: "post-a", igMediaId: "ig-a", format: "REDESIGN" });
    const postB = fakePost({ id: "post-b", igMediaId: "ig-b", format: "REDESIGN" });
    const repo = makeRepo({ posts: [postA, postB] });
    await repo.addSnapshot("post-a", new Date(), emptyMetrics({ reach: 100 }));
    await repo.addSnapshot("post-b", new Date(), emptyMetrics({ reach: null }));

    const service = new SocialService(repo, makeInstagram([]), null, undefined);
    const rows = await service.getComparison();

    const row = rows.find((r) => r.format === "REDESIGN")!;
    expect(row.postCount).toBe(2);
    expect(row.avgReach).toBe(100);
  });

  it("post sem snapshot nao conta nas medias mas conta no postCount", async () => {
    const postA = fakePost({ id: "post-a", igMediaId: "ig-a", format: "REDESIGN" });
    const postB = fakePost({ id: "post-b", igMediaId: "ig-b", format: "REDESIGN" });
    const repo = makeRepo({ posts: [postA, postB] });
    await repo.addSnapshot("post-a", new Date(), emptyMetrics({ reach: 200 }));
    // post-b nunca teve snapshot coletado.

    const service = new SocialService(repo, makeInstagram([]), null, undefined);
    const rows = await service.getComparison();

    const row = rows.find((r) => r.format === "REDESIGN")!;
    expect(row.postCount).toBe(2);
    expect(row.avgReach).toBe(200);
  });

  it("avgInteractions ignora post com as 4 metricas de interacao null", async () => {
    const postA = fakePost({ id: "post-a", igMediaId: "ig-a", format: "REDESIGN" });
    const postB = fakePost({ id: "post-b", igMediaId: "ig-b", format: "REDESIGN" });
    const repo = makeRepo({ posts: [postA, postB] });
    await repo.addSnapshot(
      "post-a",
      new Date(),
      emptyMetrics({ likes: 10, comments: 2, saved: 1, shares: 0 }),
    ); // soma = 13
    await repo.addSnapshot(
      "post-b",
      new Date(),
      emptyMetrics({ likes: null, comments: null, saved: null, shares: null }),
    ); // fora da media

    const service = new SocialService(repo, makeInstagram([]), null, undefined);
    const rows = await service.getComparison();

    const row = rows.find((r) => r.format === "REDESIGN")!;
    expect(row.avgInteractions).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// setFormat()
// ---------------------------------------------------------------------------

describe("SocialService.setFormat", () => {
  it("grava format com source MANUAL", async () => {
    const post = fakePost({ id: "post-1", igMediaId: "ig-1", format: "UNCLASSIFIED" });
    const repo = makeRepo({ posts: [post] });
    const service = new SocialService(repo, makeInstagram([]), null, undefined);

    const updated = await service.setFormat("post-1", "TIMELAPSE");

    expect(updated.format).toBe("TIMELAPSE");
    expect(updated.formatSource).toBe("MANUAL");
  });

  it("post inexistente lanca NotFoundError", async () => {
    const repo = makeRepo();
    const service = new SocialService(repo, makeInstagram([]), null, undefined);

    await expect(service.setFormat("nao-existe", "TIMELAPSE")).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// getSeries()
// ---------------------------------------------------------------------------

describe("SocialService.getSeries", () => {
  it("post inexistente lanca NotFoundError", async () => {
    const repo = makeRepo();
    const service = new SocialService(repo, makeInstagram([]), null, undefined);

    await expect(service.getSeries("nao-existe")).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// generateAnalysis()
// ---------------------------------------------------------------------------

describe("SocialService.generateAnalysis", () => {
  it("sem analyst lanca AiNotConfiguredError", async () => {
    const repo = makeRepo();
    const service = new SocialService(repo, makeInstagram([]), null, undefined);

    await expect(service.generateAnalysis()).rejects.toThrow(AiNotConfiguredError);
  });

  it("monta PostSummaryForAnalysis a partir de listPosts e repassa ao analyst", async () => {
    const post = fakePost({
      id: "post-1",
      igMediaId: "ig-1",
      caption: "Antes e depois da reforma",
      mediaType: "VIDEO",
      format: "BEFORE_AFTER",
    });
    const repo = makeRepo({ posts: [post] });
    await repo.addSnapshot("post-1", new Date(), emptyMetrics({ reach: 300, likes: 20 }));
    const analyst = makeAnalyst();
    const service = new SocialService(repo, makeInstagram([]), analyst, undefined);

    await service.generateAnalysis();

    expect(analyst.analyze).toHaveBeenCalledTimes(1);
    const [summaries] = (analyst.analyze as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      caption: "Antes e depois da reforma",
      mediaType: "VIDEO",
      format: "BEFORE_AFTER",
      reach: 300,
      likes: 20,
      views: null,
    });
  });
});
