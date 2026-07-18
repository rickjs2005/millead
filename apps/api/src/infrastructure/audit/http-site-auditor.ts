import * as cheerio from "cheerio";
import type {
  AuditCategoryResult,
  AuditCheck,
  SiteAuditResult,
  SiteAuditor,
} from "../../domain/services/site-auditor.js";
import { safeFetch } from "./safe-fetch.js";

const FETCH_TIMEOUT_MS = 20_000;
const AUX_FETCH_TIMEOUT_MS = 6_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2MB -- suficiente pra qualquer homepage razoável
const USER_AGENT = "MilLeadAuditBot/1.0 (auditoria de site; contato: milweb)";

/** Categoria em construção: acumula checks e fecha com o score ponderado. */
class CategoryBuilder {
  private checks: AuditCheck[] = [];

  add(id: string, label: string, passed: boolean, weight: number, info?: string) {
    this.checks.push({ id, label, passed, weight, ...(info ? { info } : {}) });
  }

  build(category: AuditCategoryResult["category"]): AuditCategoryResult {
    const totalWeight = this.checks.reduce((sum, c) => sum + c.weight, 0);
    const passedWeight = this.checks
      .filter((c) => c.passed)
      .reduce((sum, c) => sum + c.weight, 0);
    const score = totalWeight === 0 ? 0 : Math.round((passedWeight / totalWeight) * 100);
    return { category, score, checks: this.checks };
  }
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Fetch auxiliar (robots.txt, sitemap...) -- falha vira null, nunca derruba a auditoria. */
async function tryFetch(url: string, method: "GET" | "HEAD" = "GET"): Promise<Response | null> {
  try {
    return await safeFetch(url, {
      method,
      signal: AbortSignal.timeout(AUX_FETCH_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
  } catch {
    return null;
  }
}

export class HttpSiteAuditor implements SiteAuditor {
  async audit(rawUrl: string): Promise<SiteAuditResult> {
    const url = normalizeUrl(rawUrl);

    const startedAt = Date.now();
    let response: Response;
    try {
      response = await safeFetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      });
    } catch (err) {
      // Alvo interno / URL inválida -> mensagem específica (guarda de SSRF).
      if (
        err instanceof Error &&
        /interno|inválida|não permitido|resolver|redirecionamentos/i.test(err.message)
      ) {
        throw new Error(`endereço não permitido para auditoria (${err.message.toLowerCase()})`);
      }
      const reason =
        err instanceof Error && err.name === "TimeoutError"
          ? `o site não respondeu em ${FETCH_TIMEOUT_MS / 1000}s`
          : "o site está inacessível (DNS, conexão recusada ou certificado inválido)";
      throw new Error(reason);
    }
    const responseTimeMs = Date.now() - startedAt;

    if (!response.ok) {
      throw new Error(`o site respondeu HTTP ${response.status}`);
    }

    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const $ = cheerio.load(html);
    const finalUrl = response.url || url;
    const origin = new URL(finalUrl).origin;
    const headers = response.headers;
    const isHttps = finalUrl.startsWith("https://");

    // ---- Fetches auxiliares em paralelo (best-effort) ----
    const [robotsRes, sitemapRes, faviconRes] = await Promise.all([
      tryFetch(`${origin}/robots.txt`),
      tryFetch(`${origin}/sitemap.xml`, "HEAD"),
      $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0
        ? Promise.resolve(null) // já tem favicon declarado, não precisa testar o padrão
        : tryFetch(`${origin}/favicon.ico`, "HEAD"),
    ]);
    const hasRobots = robotsRes?.ok ?? false;
    const hasSitemap =
      (sitemapRes?.ok ?? false) ||
      (hasRobots && /sitemap:/i.test((await robotsRes?.text().catch(() => "")) ?? ""));

    // ---- Elementos do HTML usados por várias categorias ----
    const title = $("head title").first().text().trim();
    const metaDescription = ($('meta[name="description"]').attr("content") ?? "").trim();
    const metaRobots = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
    const viewport = ($('meta[name="viewport"]').attr("content") ?? "").toLowerCase();
    const htmlLang = ($("html").attr("lang") ?? "").trim();
    const h1Count = $("h1").length;
    const imgs = $("img").toArray();
    const imgsWithAlt = imgs.filter((el) => ($(el).attr("alt") ?? "").trim().length > 0).length;
    const hasFaviconTag =
      $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0;
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDescription = $('meta[property="og:description"]').attr("content");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const canonical = $('link[rel="canonical"]').attr("href");
    const htmlBytes = Buffer.byteLength(html, "utf8");
    const deprecatedTags = $("font, marquee, center, blink").length;
    const mixedContent = isHttps
      ? $('[src^="http://"], link[href^="http://"]').length
      : 0;

    // ---- PERFORMANCE ----
    const performance = new CategoryBuilder();
    performance.add(
      "response-time",
      "Tempo de resposta",
      responseTimeMs < 1500,
      3,
      `${responseTimeMs}ms (bom: < 1500ms)`,
    );
    performance.add(
      "html-size",
      "Tamanho do HTML",
      htmlBytes < 200 * 1024,
      2,
      `${Math.round(htmlBytes / 1024)}KB (bom: < 200KB)`,
    );
    performance.add(
      "compression",
      "Compressão (gzip/brotli)",
      /gzip|br|deflate|zstd/.test(headers.get("content-encoding") ?? ""),
      2,
      headers.get("content-encoding") ?? "sem content-encoding",
    );
    performance.add(
      "cache-headers",
      "Cache configurado",
      !!(headers.get("cache-control") ?? headers.get("etag") ?? headers.get("last-modified")),
      1,
    );
    performance.add(
      "img-volume",
      "Volume de imagens na página",
      imgs.length <= 50,
      1,
      `${imgs.length} imagens`,
    );

    // ---- SEO ----
    const seo = new CategoryBuilder();
    seo.add(
      "title",
      "Título da página (<title>)",
      title.length >= 10 && title.length <= 70,
      2,
      title ? `"${title.slice(0, 60)}" (${title.length} chars, bom: 10-70)` : "ausente",
    );
    seo.add(
      "meta-description",
      "Meta description",
      metaDescription.length >= 50 && metaDescription.length <= 160,
      2,
      metaDescription
        ? `${metaDescription.length} chars (bom: 50-160)`
        : "ausente",
    );
    seo.add("h1", "Um único H1 na página", h1Count === 1, 1, `${h1Count} encontrado(s)`);
    seo.add("canonical", "URL canônica declarada", !!canonical, 1);
    seo.add("og-tags", "Open Graph (título + descrição)", !!(ogTitle && ogDescription), 1);
    seo.add("robots-txt", "robots.txt presente", hasRobots, 1);
    seo.add("sitemap", "Sitemap XML presente", hasSitemap, 1);
    seo.add(
      "indexable",
      "Página indexável (sem noindex)",
      !metaRobots.includes("noindex"),
      2,
      metaRobots || "sem meta robots (indexável)",
    );

    // ---- ACESSIBILIDADE ----
    const accessibility = new CategoryBuilder();
    accessibility.add(
      "lang",
      "Idioma declarado (<html lang>)",
      htmlLang.length > 0,
      2,
      htmlLang || "ausente",
    );
    accessibility.add(
      "img-alts",
      "Imagens com texto alternativo",
      imgs.length === 0 || imgsWithAlt / imgs.length >= 0.9,
      3,
      imgs.length === 0 ? "sem imagens" : `${imgsWithAlt}/${imgs.length} com alt`,
    );
    accessibility.add("page-title", "Página tem título", title.length > 0, 1);
    accessibility.add(
      "zoom",
      "Zoom não bloqueado",
      !viewport.includes("user-scalable=no") && !viewport.includes("maximum-scale=1"),
      2,
    );
    accessibility.add(
      "landmarks",
      "Estrutura semântica (main/nav/header)",
      $("main, nav, header, [role='main']").length > 0,
      1,
    );

    // ---- SEGURANÇA ----
    const security = new CategoryBuilder();
    security.add("https", "HTTPS", isHttps, 3, isHttps ? "ok" : "site servido em HTTP");
    security.add("hsts", "HSTS (Strict-Transport-Security)", !!headers.get("strict-transport-security"), 2);
    security.add(
      "content-type-options",
      "X-Content-Type-Options: nosniff",
      (headers.get("x-content-type-options") ?? "").toLowerCase().includes("nosniff"),
      1,
    );
    security.add(
      "frame-protection",
      "Proteção contra clickjacking",
      !!headers.get("x-frame-options") ||
        (headers.get("content-security-policy") ?? "").includes("frame-ancestors"),
      1,
    );
    security.add(
      "csp",
      "Content-Security-Policy",
      !!headers.get("content-security-policy"),
      2,
    );
    security.add(
      "mixed-content",
      "Sem conteúdo misto (http:// em página https)",
      mixedContent === 0,
      2,
      mixedContent > 0 ? `${mixedContent} recurso(s) em http://` : "ok",
    );

    // ---- MOBILE ----
    const mobile = new CategoryBuilder();
    mobile.add("viewport", "Meta viewport presente", viewport.length > 0, 3);
    mobile.add(
      "device-width",
      "Viewport responsivo (width=device-width)",
      viewport.includes("width=device-width"),
      2,
    );
    mobile.add(
      "touch-icon",
      "Ícone pra tela inicial (apple-touch-icon)",
      $('link[rel="apple-touch-icon"]').length > 0,
      1,
    );
    mobile.add(
      "responsive-images",
      "Imagens responsivas (srcset)",
      imgs.length <= 5 || imgs.some((el) => !!$(el).attr("srcset")),
      1,
      imgs.length <= 5 ? "poucas imagens" : undefined,
    );

    // ---- DESIGN ----
    const design = new CategoryBuilder();
    design.add(
      "doctype",
      "DOCTYPE HTML5",
      /^\s*<!doctype html>/i.test(html),
      1,
    );
    design.add("favicon", "Favicon", hasFaviconTag || (faviconRes?.ok ?? false), 2);
    design.add("og-image", "Imagem de compartilhamento (og:image)", !!ogImage, 1);
    design.add(
      "no-deprecated",
      "Sem tags obsoletas (font/marquee/center)",
      deprecatedTags === 0,
      2,
      deprecatedTags > 0 ? `${deprecatedTags} encontrada(s)` : "ok",
    );
    design.add(
      "styles",
      "CSS presente",
      $('link[rel="stylesheet"], style').length > 0,
      1,
    );

    const categories: AuditCategoryResult[] = [
      performance.build("PERFORMANCE"),
      seo.build("SEO"),
      accessibility.build("ACCESSIBILITY"),
      security.build("SECURITY"),
      mobile.build("MOBILE"),
      design.build("DESIGN"),
    ];

    const overall = Math.round(
      categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
    );
    const sorted = [...categories].sort((a, b) => b.score - a.score);
    const best = sorted[0]!;
    const worst = sorted[sorted.length - 1]!;
    const categoryLabel: Record<string, string> = {
      PERFORMANCE: "performance",
      SEO: "SEO",
      ACCESSIBILITY: "acessibilidade",
      SECURITY: "segurança",
      MOBILE: "mobile",
      DESIGN: "design",
    };
    const summary =
      `Nota geral ${overall}/100 — respondeu em ${responseTimeMs}ms. ` +
      `Melhor categoria: ${categoryLabel[best.category]} (${best.score}). ` +
      `Maior oportunidade: ${categoryLabel[worst.category]} (${worst.score}).`;

    return {
      url,
      finalUrl,
      httpStatus: response.status,
      responseTimeMs,
      summary,
      categories,
      rawData: {
        fetchedAt: new Date().toISOString(),
        url,
        finalUrl,
        httpStatus: response.status,
        responseTimeMs,
        htmlBytes,
        overallScore: overall,
        hasRobots,
        hasSitemap,
        counts: {
          images: imgs.length,
          imagesWithAlt: imgsWithAlt,
          h1: h1Count,
          scripts: $("script").length,
          stylesheets: $('link[rel="stylesheet"]').length,
        },
        headers: {
          server: headers.get("server"),
          contentType: headers.get("content-type"),
          contentEncoding: headers.get("content-encoding"),
          cacheControl: headers.get("cache-control"),
          hsts: headers.get("strict-transport-security"),
          csp: headers.get("content-security-policy") ? "presente" : null,
        },
      },
    };
  }
}
