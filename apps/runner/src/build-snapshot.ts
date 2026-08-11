import { createHash } from "node:crypto";
import type { Snapshot, SnapshotNode } from "@millead/video-contracts";
import type { Page } from "playwright";
import { captureSections } from "./capture-sections.js";
import { captureTiles } from "./capture-tiles.js";
import { extractNodes } from "./extract.js";

export const USER_AGENT = "MilLeadVideoBot/1.0 (captura para vídeo; contato: milweb)";
export const LOCALE = "pt-BR";
export const TIMEZONE = "America/Sao_Paulo";

function slugPath(pathname: string): string {
  const cleaned = pathname.replace(/^\/+|\/+$/g, "");
  if (cleaned === "") return "home";
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * "milweb.com.br-home-desktop-20260729143205-9f2a1c" -- derivado, sem Date.now().
 * O carimbo tem SEGUNDOS e há um hash da URL completa porque só o slug colide:
 * "/a/b" e "/a-b" normalizam para o mesmo texto, e duas capturas da mesma URL
 * no mesmo minuto se sobrescreviam sem aviso.
 */
export function buildSnapshotId(url: URL, capturedAt: string): string {
  const stamp = capturedAt.replace(/[-:]/g, "").replace(/T/, "").slice(0, 14);
  const hash = createHash("sha1").update(url.toString()).digest("hex").slice(0, 6);
  return `${url.hostname}-${slugPath(url.pathname)}-desktop-${stamp}-${hash}`;
}

async function sampleColors(page: Page): Promise<{ hex: string; weight: number }[]> {
  return page.evaluate(() => {
    const tally = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll("*")).slice(0, 500)) {
      const bg = getComputedStyle(el).backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") continue;
      tally.set(bg, (tally.get(bg) ?? 0) + 1);
    }
    const total = Array.from(tally.values()).reduce((sum, n) => sum + n, 0) || 1;
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([hex, count]) => ({ hex, weight: Number((count / total).toFixed(4)) }));
  });
}

export async function capturePage(
  page: Page,
  opts: { url: URL; capturedAt: string; outDir: string; status: number; finalUrl: string },
): Promise<Snapshot> {
  const tiles = await captureTiles(page, opts.outDir);
  const rawNodes = await extractNodes(page);
  const nodes: SnapshotNode[] = await captureSections(page, rawNodes, opts.outDir);

  const meta = await page.evaluate(() => ({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    lang: document.documentElement.lang || "",
    pageHeight: document.documentElement.scrollHeight,
  }));

  const warnings: string[] = [];
  if (!nodes.some((n) => n.isSection)) {
    warnings.push(
      "nenhuma seção detectada: a página provavelmente monta tudo em <div> sem altura suficiente",
    );
  }

  return {
    version: 1,
    id: buildSnapshotId(opts.url, opts.capturedAt),
    url: opts.url.toString(),
    capturedAt: opts.capturedAt,
    http: { status: opts.status, finalUrl: opts.finalUrl, redirects: [] },
    page: { title: meta.title, description: meta.description, lang: meta.lang },
    capture: {
      viewport: { width: 1920, height: 1080, dpr: 1 },
      userAgent: USER_AGENT,
      locale: LOCALE,
      timezone: TIMEZONE,
      pageHeight: meta.pageHeight,
      tiles,
    },
    theme: { colors: await sampleColors(page) },
    warnings,
    nodes,
  };
}
