import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { LOCALE, TIMEZONE, USER_AGENT, buildSnapshotId, capturePage } from "./build-snapshot.js";
import { assertPublicUrl } from "./url-guard.js";
import { writePackage } from "./write-package.js";

const NAV_TIMEOUT_MS = 30_000;

/**
 * A promoção do pacote (writePackage) move o diretório antigo para
 * "<id>.anterior" antes de trocar o novo para o lugar, e só apaga o
 * ".anterior" no final. Se o processo morrer no meio (crash, kill, queda de
 * energia), esse diretório fica órfão no disco -- e como o id carrega
 * carimbo de SEGUNDOS, é rara a próxima captura repetir o mesmo id para a
 * autocura "de graça" acontecer. Por isso varre e limpa aqui, no início de
 * toda captura.
 */
async function limparAnterioresOrfaos(capturesRoot: string): Promise<void> {
  let entradas: string[];
  try {
    entradas = await readdir(capturesRoot);
  } catch {
    // capturesRoot ainda não existe -- nada para limpar, não é erro.
    return;
  }

  await Promise.all(
    entradas
      .filter((nome) => nome.endsWith(".anterior"))
      .map((nome) => rm(join(capturesRoot, nome), { recursive: true, force: true })),
  );
}

export async function runCapture(
  rawUrl: string,
  opts: { capturedAt: string; capturesRoot: string; allowPrivate?: boolean },
): Promise<string> {
  await limparAnterioresOrfaos(opts.capturesRoot);

  // A guarda roda sobre a URL crua, ANTES do page.goto -- mas só vê o
  // endereço inicial. Se o site responder com um redirecionamento (30x) para
  // um alvo interno, o Playwright segue o redirect por conta própria e a
  // guarda nunca chega a examinar o destino final. Não há mitigação para
  // isso ainda; quem for mexer aqui precisa saber que a proteção termina no
  // primeiro salto.
  const url = await assertPublicUrl(rawUrl, { allowPrivate: opts.allowPrivate });
  const id = buildSnapshotId(url, opts.capturedAt);
  const tmpDir = join(opts.capturesRoot, `.tmp-${id}`);

  await rm(tmpDir, { recursive: true, force: true });
  await mkdir(tmpDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      userAgent: USER_AGENT,
      locale: LOCALE,
      timezoneId: TIMEZONE,
    });
    const page = await context.newPage();

    const response = await page.goto(url.toString(), {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT_MS,
    });
    if (!response) throw new Error("o site não respondeu");
    if (!response.ok()) throw new Error(`o site respondeu HTTP ${response.status()}`);

    // HTML servido, cru -- permite reprocessar a análise sem reabrir o site.
    // É o body da resposta, não o DOM renderizado.
    await writeFile(join(tmpDir, "dom.html"), await response.text(), "utf8");

    const snapshot = await capturePage(page, {
      url,
      capturedAt: opts.capturedAt,
      outDir: tmpDir,
      status: response.status(),
      finalUrl: page.url(),
    });

    return await writePackage(snapshot, tmpDir, opts.capturesRoot);
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true });
    throw err;
  } finally {
    // Sem isto, o Chromium vira zumbi quando o processo morre por timeout.
    await browser.close();
  }
}

async function main(): Promise<void> {
  const rawUrl = process.argv[2];
  if (!rawUrl) {
    console.error("uso: pnpm capture <url>");
    process.exitCode = 1;
    return;
  }

  try {
    const finalDir = await runCapture(rawUrl, {
      // Único timestamp do fluxo, injetado aqui na borda.
      capturedAt: new Date().toISOString(),
      capturesRoot: join(process.cwd(), "captures"),
      allowPrivate: process.env.VIDEO_RUNNER_ALLOW_PRIVATE === "1",
    });
    console.log(`pacote gravado em ${finalDir}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

// Só executa quando chamado como CLI, nunca quando importado pelos testes.
if (process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js")) {
  await main();
}
