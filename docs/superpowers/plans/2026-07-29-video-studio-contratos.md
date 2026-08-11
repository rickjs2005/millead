# Video Studio — contratos e crawler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar os quatro contratos de dados do Video Studio (`Snapshot`, `Annotation`, `VideoProject`, `RenderManifest`) e o crawler Playwright que produz um pacote de captura válido a partir de uma URL.

**Architecture:** Dois workspaces novos. `packages/video-contracts` guarda só schemas zod e tipos inferidos, sem dependência pesada, importável por api/web/runner. `apps/runner` é um CLI Node com Playwright que abre a URL, captura tiles e miniaturas de seção, extrai a árvore de nós com caixas em espaço de documento, e escreve `captures/<snapshotId>/` só depois de o zod validar a saída. `apps/api` não é tocado.

**Tech Stack:** TypeScript 5.7 (ESM, NodeNext), zod 3.24, Playwright, Vitest, pnpm 10 workspaces, Turborepo.

**Spec:** `docs/superpowers/specs/2026-07-29-video-studio-contratos-design.md`

## Global Constraints

- Node `>=22.12.0`, pnpm `>=10.0.0` (o repo fixa `packageManager: pnpm@10.33.4`).
- **zod `^3.24.1`** — há um `overrides` na raiz; não instalar zod 4.
- Todo pacote novo é **ESM**: `"type": "module"` no `package.json`.
- tsconfig estende `@millead/typescript-config/node.json`. eslint estende `@millead/eslint-config` via `eslint.config.js` com `import base from "@millead/eslint-config"; export default base;`.
- Testes **colocados junto do código** como `src/**/*.test.ts`, rodados por Vitest (`environment: "node"`). É o padrão de `apps/api/vitest.config.ts`.
- **Mensagens de erro em português**, no tom do `apps/api/src/infrastructure/audit/http-site-auditor.ts`.
- **Determinismo:** proibido `Date.now()` e `Math.random()` na geração. O único timestamp é `capturedAt`, recebido como parâmetro pelo topo do fluxo.
- **NUNCA adicionar `playwright` ao `onlyBuiltDependencies` do `package.json` da raiz.** O `render.yaml` roda `pnpm install` na raiz; a allowlist do pnpm 10 é o que impede o Render de baixar ~150 MB de Chromium e quebrar o build da API em produção.
- O crawler **não pode depender de atributo colocado no HTML de propósito** (`data-video-section` e afins).
- Branch de trabalho: `feat/video-studio-contratos` (já criada).
- Commits em português, prefixo `feat:` / `test:` / `docs:` / `chore:`.

---

### Task 1: Pacote `video-contracts` com o schema do Snapshot

**Files:**

- Create: `packages/video-contracts/package.json`
- Create: `packages/video-contracts/tsconfig.json`
- Create: `packages/video-contracts/eslint.config.js`
- Create: `packages/video-contracts/vitest.config.ts`
- Create: `packages/video-contracts/src/snapshot.ts`
- Create: `packages/video-contracts/src/index.ts`
- Test: `packages/video-contracts/src/snapshot.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: `SnapshotSchema`, `SnapshotNodeSchema`, `BoxSchema`, `TileSchema` e os tipos `Snapshot`, `SnapshotNode`, `Box`, `Tile`. Todas as tasks seguintes importam de `@millead/video-contracts`.

- [ ] **Step 1: Criar o esqueleto do pacote**

`packages/video-contracts/package.json`:

```json
{
  "name": "@millead/video-contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@millead/eslint-config": "workspace:*",
    "@millead/typescript-config": "workspace:*",
    "@types/node": "^22.10.2",
    "eslint": "^9.17.0",
    "typescript": "^5.7.2",
    "vitest": "^4.1.10"
  }
}
```

`packages/video-contracts/tsconfig.json`:

```json
{
  "extends": "@millead/typescript-config/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

`packages/video-contracts/eslint.config.js`:

```js
import base from "@millead/eslint-config";

export default base;
```

`packages/video-contracts/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 2: Instalar o workspace**

Run: `pnpm install`
Expected: pnpm reconhece `packages/video-contracts` (o `pnpm-workspace.yaml` já cobre `packages/*`). Sem erro.

- [ ] **Step 3: Escrever o teste que falha**

`packages/video-contracts/src/snapshot.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SnapshotSchema } from "./snapshot.js";

function validSnapshot() {
  return {
    version: 1 as const,
    id: "milweb.com.br-home-desktop-202607291432",
    url: "https://milweb.com.br/",
    capturedAt: "2026-07-29T14:32:00.000Z",
    http: { status: 200, finalUrl: "https://milweb.com.br/", redirects: [] },
    page: { title: "MilWeb", description: "Sites sob medida", lang: "pt-BR" },
    capture: {
      viewport: { width: 1920, height: 1080, dpr: 1 },
      userAgent: "MilLeadVideoBot/1.0",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      pageHeight: 4320,
      tiles: [{ file: "tiles/000-y0.webp", scrollY: 0, height: 1080 }],
    },
    theme: { colors: [{ hex: "#0B0B0F", weight: 0.62 }] },
    warnings: [],
    nodes: [
      {
        nodeId: "n0",
        parentId: null,
        fingerprint: "a1b2c3d4e5f60718",
        selector: "main > section:nth-child(1)",
        tag: "section",
        id: "hero",
        classes: ["min-h-screen"],
        box: { x: 0, y: 0, w: 1920, h: 1080 },
        visible: true,
        isSection: true,
        screenshot: "sections/hero.webp",
      },
    ],
  };
}

describe("SnapshotSchema", () => {
  it("aceita um snapshot completo", () => {
    expect(() => SnapshotSchema.parse(validSnapshot())).not.toThrow();
  });

  it("recusa version diferente de 1", () => {
    const bad = { ...validSnapshot(), version: 2 };
    expect(() => SnapshotSchema.parse(bad)).toThrow();
  });

  it("recusa nó de seção sem screenshot", () => {
    const snap = validSnapshot();
    const [node] = snap.nodes;
    delete (node as Record<string, unknown>).screenshot;
    expect(() => SnapshotSchema.parse(snap)).toThrow(/screenshot/i);
  });

  it("recusa caixa com largura negativa", () => {
    const snap = validSnapshot();
    snap.nodes[0]!.box.w = -1;
    expect(() => SnapshotSchema.parse(snap)).toThrow();
  });

  it("recusa nodeId duplicado", () => {
    const snap = validSnapshot();
    snap.nodes.push({ ...snap.nodes[0]! });
    expect(() => SnapshotSchema.parse(snap)).toThrow(/nodeId/i);
  });
});
```

- [ ] **Step 4: Rodar o teste e ver falhar**

Run: `pnpm --filter @millead/video-contracts test`
Expected: FAIL — `Cannot find module './snapshot.js'`.

- [ ] **Step 5: Implementar o schema**

`packages/video-contracts/src/snapshot.ts`:

```ts
import { z } from "zod";

export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
});

export const TileSchema = z.object({
  file: z.string().min(1),
  scrollY: z.number().nonnegative(),
  height: z.number().positive(),
});

export const SnapshotNodeSchema = z
  .object({
    nodeId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    fingerprint: z.string().min(1),
    selector: z.string().min(1),
    tag: z.string().min(1),
    id: z.string().optional(),
    classes: z.array(z.string()),
    role: z.string().optional(),
    ariaLabel: z.string().optional(),
    box: BoxSchema,
    visible: z.boolean(),
    isSection: z.boolean(),
    text: z.string().optional(),
    media: z
      .object({
        type: z.enum(["img", "video"]),
        src: z.string(),
        naturalW: z.number().nonnegative(),
        naturalH: z.number().nonnegative(),
      })
      .optional(),
    counts: z
      .object({
        images: z.number().int().nonnegative(),
        videos: z.number().int().nonnegative(),
        buttons: z.number().int().nonnegative(),
        inputs: z.number().int().nonnegative(),
        links: z.number().int().nonnegative(),
      })
      .optional(),
    screenshot: z.string().optional(),
  })
  .refine((n) => !n.isSection || typeof n.screenshot === "string", {
    message: "nó com isSection true precisa de screenshot",
    path: ["screenshot"],
  });

export const SnapshotSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    url: z.string().url(),
    capturedAt: z.string().datetime(),
    http: z.object({
      status: z.number().int(),
      finalUrl: z.string().url(),
      redirects: z.array(z.string().url()),
    }),
    page: z.object({
      title: z.string(),
      description: z.string(),
      lang: z.string(),
    }),
    capture: z.object({
      viewport: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        dpr: z.number().positive(),
      }),
      userAgent: z.string().min(1),
      locale: z.string().min(1),
      timezone: z.string().min(1),
      pageHeight: z.number().nonnegative(),
      tiles: z.array(TileSchema),
    }),
    theme: z.object({
      colors: z.array(z.object({ hex: z.string(), weight: z.number() })),
    }),
    warnings: z.array(z.string()),
    nodes: z.array(SnapshotNodeSchema),
  })
  .superRefine((snap, ctx) => {
    const seen = new Set<string>();
    for (const node of snap.nodes) {
      if (seen.has(node.nodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `nodeId duplicado: ${node.nodeId}`,
          path: ["nodes"],
        });
      }
      seen.add(node.nodeId);
    }
  });

export type Box = z.infer<typeof BoxSchema>;
export type Tile = z.infer<typeof TileSchema>;
export type SnapshotNode = z.infer<typeof SnapshotNodeSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
```

`packages/video-contracts/src/index.ts`:

```ts
export * from "./snapshot.js";
```

- [ ] **Step 6: Rodar os testes e ver passar**

Run: `pnpm --filter @millead/video-contracts test`
Expected: PASS — 5 testes.

- [ ] **Step 7: Type-check e lint**

Run: `pnpm --filter @millead/video-contracts type-check && pnpm --filter @millead/video-contracts lint`
Expected: sem erro.

- [ ] **Step 8: Commit**

```bash
git add packages/video-contracts
git commit -m "feat: schema do Snapshot em @millead/video-contracts"
```

---

### Task 2: Schemas de Annotation, VideoProject e RenderManifest

**Files:**

- Create: `packages/video-contracts/src/annotation.ts`
- Create: `packages/video-contracts/src/project.ts`
- Create: `packages/video-contracts/src/manifest.ts`
- Modify: `packages/video-contracts/src/index.ts`
- Test: `packages/video-contracts/src/project.test.ts`

**Interfaces:**

- Consumes: nada de Task 1 além do pacote existir.
- Produces: `AnnotationSchema`/`Annotation`, `VideoProjectSchema`/`VideoProject`, `SceneSchema`/`Scene`, `RenderManifestSchema`/`RenderManifest`. Nenhuma task deste plano consome esses três — eles existem porque a spec define a cadeia inteira e porque as fronteiras (segundos vs frames) precisam estar travadas antes de alguém escrever o compilador.

- [ ] **Step 1: Escrever o teste que falha**

`packages/video-contracts/src/project.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AnnotationSchema } from "./annotation.js";
import { RenderManifestSchema } from "./manifest.js";
import { VideoProjectSchema } from "./project.js";

describe("VideoProjectSchema", () => {
  const project = {
    version: 1 as const,
    id: "prj_kavita_reel",
    name: "Kavita — Reel de lançamento",
    snapshotIds: ["milweb.com.br-home-desktop-202607291432"],
    format: "9:16" as const,
    fps: 30,
    scenes: [
      {
        id: "sc1",
        type: "site" as const,
        source: { snapshotId: "milweb.com.br-home-desktop-202607291432", nodeId: "n0" },
        shot: "zoom" as const,
        durationSec: 8,
        hidden: [],
      },
      {
        id: "sc2",
        type: "studio" as const,
        component: "whatsapp" as const,
        props: { company: "Kavita Drones" },
        durationSec: 5,
      },
    ],
    voice: null,
  };

  it("aceita cenas de site e de estúdio na mesma timeline", () => {
    expect(() => VideoProjectSchema.parse(project)).not.toThrow();
  });

  it("recusa cena de site sem source", () => {
    const bad = structuredClone(project);
    delete (bad.scenes[0] as Record<string, unknown>).source;
    expect(() => VideoProjectSchema.parse(bad)).toThrow();
  });

  it("recusa componente de estúdio desconhecido", () => {
    const bad = structuredClone(project);
    (bad.scenes[1] as Record<string, unknown>).component = "tiktok";
    expect(() => VideoProjectSchema.parse(bad)).toThrow();
  });

  it("recusa id de cena duplicado", () => {
    const bad = structuredClone(project);
    bad.scenes[1]!.id = "sc1";
    expect(() => VideoProjectSchema.parse(bad)).toThrow(/duplicad/i);
  });
});

describe("AnnotationSchema", () => {
  it("exige evidence para sustentar a certainty", () => {
    const bad = {
      version: 1,
      id: "ann1",
      snapshotId: "s1",
      generatedAt: "2026-07-29T14:40:00.000Z",
      model: "claude-opus-5",
      promptVersion: "v1",
      labels: [{ nodeId: "n0", label: "Hero", kind: "hero", certainty: "alta", evidence: [] }],
      suggestion: { nodeIds: ["n0"], durationSec: 30, rationale: "abre com o hero" },
    };
    expect(() => AnnotationSchema.parse(bad)).toThrow(/evid/i);
  });
});

describe("RenderManifestSchema", () => {
  it("recusa clip com endFrame menor ou igual ao startFrame", () => {
    const bad = {
      version: 1,
      projectId: "prj_kavita_reel",
      compiledFrom: { snapshotIds: ["s1"], projectVersion: 1 },
      resolution: { w: 1080, h: 1920 },
      fps: 30,
      totalFrames: 900,
      clips: [{ sceneId: "sc1", startFrame: 60, endFrame: 60, component: "SiteZoom", props: {} }],
      audio: [],
    };
    expect(() => RenderManifestSchema.parse(bad)).toThrow(/endFrame/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/video-contracts test`
Expected: FAIL — módulos `./annotation.js`, `./manifest.js`, `./project.js` não existem.

- [ ] **Step 3: Implementar `annotation.ts`**

```ts
import { z } from "zod";

export const AnnotationSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  generatedAt: z.string().datetime(),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  labels: z.array(
    z.object({
      nodeId: z.string().min(1),
      label: z.string().min(1),
      kind: z.string().min(1),
      // Derivada dos sinais determinísticos em `evidence` -- nunca um número
      // auto-relatado pelo modelo.
      certainty: z.enum(["alta", "media", "baixa"]),
      evidence: z.array(z.string()).min(1, "certainty precisa de ao menos uma evidência"),
    }),
  ),
  suggestion: z.object({
    nodeIds: z.array(z.string().min(1)),
    durationSec: z.number().positive(),
    rationale: z.string().min(1),
  }),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
```

- [ ] **Step 4: Implementar `project.ts`**

```ts
import { z } from "zod";

const SiteSceneSchema = z.object({
  id: z.string().min(1),
  type: z.literal("site"),
  source: z.object({ snapshotId: z.string().min(1), nodeId: z.string().min(1) }),
  shot: z.enum(["scroll", "zoom", "hold"]),
  durationSec: z.number().positive(),
  // Vira `display:none` injetado antes da captura pesada.
  hidden: z.array(z.string()),
  caption: z.string().optional(),
});

const StudioSceneSchema = z.object({
  id: z.string().min(1),
  type: z.literal("studio"),
  component: z.enum(["notebook", "google", "whatsapp", "logo"]),
  props: z.record(z.unknown()),
  durationSec: z.number().positive(),
});

export const SceneSchema = z.discriminatedUnion("type", [SiteSceneSchema, StudioSceneSchema]);

export const VideoProjectSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    // Referencia snapshots, NUNCA uma URL: é o que torna o re-render reproduzível.
    snapshotIds: z.array(z.string().min(1)).min(1),
    format: z.enum(["9:16", "16:9", "1:1"]),
    fps: z.number().int().positive(),
    // Duração em SEGUNDOS aqui; frames só no RenderManifest.
    scenes: z.array(SceneSchema).min(1),
    voice: z
      .object({
        provider: z.string().min(1),
        voiceId: z.string().min(1),
        lines: z.array(z.object({ sceneId: z.string().min(1), text: z.string().min(1) })),
      })
      .nullable(),
  })
  .superRefine((project, ctx) => {
    const seen = new Set<string>();
    for (const scene of project.scenes) {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de cena duplicado: ${scene.id}`,
          path: ["scenes"],
        });
      }
      seen.add(scene.id);
    }
  });

export type Scene = z.infer<typeof SceneSchema>;
export type VideoProject = z.infer<typeof VideoProjectSchema>;
```

- [ ] **Step 5: Implementar `manifest.ts`**

```ts
import { z } from "zod";

/**
 * O "bytecode" do compilador: derivado a cada build e descartado. Não sobra
 * nenhum seletor, nenhuma URL e nenhum segundo -- só caminho de arquivo,
 * número de frame e caixa em pixel. Se o runner precisar consultar o site ou
 * o banco para renderizar, o compilador falhou.
 */
export const RenderManifestSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1),
  compiledFrom: z.object({
    snapshotIds: z.array(z.string().min(1)),
    projectVersion: z.number().int().positive(),
  }),
  resolution: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  fps: z.number().int().positive(),
  totalFrames: z.number().int().positive(),
  clips: z.array(
    z
      .object({
        sceneId: z.string().min(1),
        startFrame: z.number().int().nonnegative(),
        endFrame: z.number().int().positive(),
        component: z.string().min(1),
        props: z.record(z.unknown()),
      })
      .refine((clip) => clip.endFrame > clip.startFrame, {
        message: "endFrame precisa ser maior que startFrame",
        path: ["endFrame"],
      }),
  ),
  audio: z.array(z.object({ file: z.string().min(1), startFrame: z.number().int().nonnegative() })),
});

export type RenderManifest = z.infer<typeof RenderManifestSchema>;
```

- [ ] **Step 6: Reexportar tudo**

`packages/video-contracts/src/index.ts`:

```ts
export * from "./annotation.js";
export * from "./manifest.js";
export * from "./project.js";
export * from "./snapshot.js";
```

- [ ] **Step 7: Rodar tudo e ver passar**

Run: `pnpm --filter @millead/video-contracts test && pnpm --filter @millead/video-contracts type-check && pnpm --filter @millead/video-contracts lint`
Expected: PASS — 11 testes no total, sem erro de tipo nem de lint.

- [ ] **Step 8: Commit**

```bash
git add packages/video-contracts
git commit -m "feat: schemas de Annotation, VideoProject e RenderManifest"
```

---

### Task 3: `apps/runner` e a guarda de URL (SSRF)

**Files:**

- Create: `apps/runner/package.json`
- Create: `apps/runner/tsconfig.json`
- Create: `apps/runner/eslint.config.js`
- Create: `apps/runner/vitest.config.ts`
- Create: `apps/runner/src/url-guard.ts`
- Test: `apps/runner/src/url-guard.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: `assertPublicUrl(raw: string, opts?: { allowPrivate?: boolean }): Promise<URL>` — normaliza (prefixa `https://` se faltar), valida protocolo e recusa alvo interno. Lança `Error` com mensagem em português. Tasks 6 e 9 chamam isso **antes** de qualquer `page.goto`.

**Contexto:** `apps/api/src/infrastructure/audit/safe-fetch.ts` já tem essa guarda, mas ela protege o `fetch`. O Playwright fala direto com a rede — `page.goto` não passa por lá. Por isso a checagem é reimplementada aqui, no ponto certo.

**Atenção:** os testes de integração das Tasks 5–7 sobem um servidor em `127.0.0.1`, que esta guarda bloqueia. Por isso `allowPrivate` existe. O CLI só liga essa opção quando `VIDEO_RUNNER_ALLOW_PRIVATE=1`, e isso fica documentado no README como recurso de teste.

- [ ] **Step 1: Criar o esqueleto do app**

`apps/runner/package.json`:

```json
{
  "name": "@millead/runner",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "capture": "tsx src/cli.ts",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "@millead/video-contracts": "workspace:*",
    "playwright": "^1.49.1",
    "tsx": "^4.19.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@millead/eslint-config": "workspace:*",
    "@millead/typescript-config": "workspace:*",
    "@types/node": "^22.10.2",
    "eslint": "^9.17.0",
    "typescript": "^5.7.2",
    "vitest": "^4.1.10"
  }
}
```

`apps/runner/tsconfig.json`:

```json
{
  "extends": "@millead/typescript-config/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

> `lib` inclui `DOM` porque o código que roda dentro do `page.evaluate` referencia `document`, `Element` e `getComputedStyle`.

`apps/runner/eslint.config.js`:

```js
import base from "@millead/eslint-config";

export default base;
```

`apps/runner/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // A captura sobe Chromium: 60s por teste é folgado e evita falso negativo
    // em máquina fria.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
```

- [ ] **Step 2: Instalar e baixar o Chromium**

Run:

```bash
pnpm install
pnpm --filter @millead/runner exec playwright install chromium
```

Expected: instala o workspace e baixa o Chromium.
**Não** adicionar `playwright` ao `onlyBuiltDependencies` da raiz — o download é sempre um passo manual e explícito.

- [ ] **Step 3: Escrever o teste que falha**

`apps/runner/src/url-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertPublicUrl } from "./url-guard.js";

describe("assertPublicUrl", () => {
  it("prefixa https quando falta protocolo", async () => {
    const url = await assertPublicUrl("milweb.com.br");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("milweb.com.br");
  });

  it("recusa protocolo que não é http(s)", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/protocolo/i);
  });

  it("recusa localhost", async () => {
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow(/interno/i);
  });

  it("recusa IP privado", async () => {
    await expect(assertPublicUrl("http://192.168.0.10")).rejects.toThrow(/interno/i);
  });

  it("recusa o metadata da nuvem", async () => {
    await expect(assertPublicUrl("http://169.254.169.254")).rejects.toThrow(/interno/i);
  });

  it("permite alvo interno quando allowPrivate está ligado", async () => {
    const url = await assertPublicUrl("http://127.0.0.1:4321/home.html", { allowPrivate: true });
    expect(url.port).toBe("4321");
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test`
Expected: FAIL — `Cannot find module './url-guard.js'`.

- [ ] **Step 5: Implementar a guarda**

`apps/runner/src/url-guard.ts`:

```ts
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts as [number, number];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // metadata da nuvem
  if (a >= 224) return true; // multicast e reservados
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80")) return true; // link-local
  const head = parseInt(normalized.slice(0, 2), 16);
  return head >= 0xfc && head <= 0xfd; // unique local (fc00::/7)
}

function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // não resolveu para IP reconhecível: trata como suspeito
}

/**
 * Valida a URL ANTES de qualquer `page.goto`. O Playwright não passa pelo
 * `safe-fetch` da API -- fala direto com a rede --, então a guarda precisa
 * viver aqui.
 */
export async function assertPublicUrl(
  raw: string,
  opts: { allowPrivate?: boolean } = {},
): Promise<URL> {
  const trimmed = raw.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`URL inválida: ${raw}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`protocolo não permitido: ${url.protocol} (use http ou https)`);
  }

  if (opts.allowPrivate) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new Error(`endereço interno não permitido: ${hostname}`);
    }
    return url;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error(`não foi possível resolver o endereço: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`endereço interno não permitido: ${hostname} resolve para ${address}`);
    }
  }

  return url;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test`
Expected: PASS — 6 testes.

- [ ] **Step 7: Commit**

```bash
git add apps/runner
git commit -m "feat: apps/runner com guarda de URL contra alvo interno"
```

---

### Task 4: Fingerprint estável

**Files:**

- Create: `apps/runner/src/fingerprint.ts`
- Test: `apps/runner/src/fingerprint.test.ts`

**Interfaces:**

- Consumes: nada.
- Produces: `fingerprint(input: FingerprintInput): string` e o tipo `FingerprintInput { tag: string; id?: string; text?: string; imageSrc?: string; siblingIndex: number }`. Task 5 chama isso para cada nó extraído.

**Por que classes ficam de fora do hash:** é exatamente isso que faz a identidade sobreviver à troca de classe Tailwind. Este é o teste que decide se o Asset Graph ("o Produto B sumiu do site") será possível um dia.

- [ ] **Step 1: Escrever o teste que falha**

`apps/runner/src/fingerprint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint.js";

const base = {
  tag: "article",
  id: "produto-b",
  text: "DJI Agras T70P",
  imageSrc: "https://cdn.kavita.com.br/img/t70p.webp?v=3",
  siblingIndex: 2,
};

describe("fingerprint", () => {
  it("é determinístico", () => {
    expect(fingerprint(base)).toBe(fingerprint(base));
  });

  it("ignora mudança de classe (não entra no hash)", () => {
    const comClasse = { ...base } as Record<string, unknown>;
    comClasse.classes = ["p-4", "rounded-xl"];
    expect(fingerprint(comClasse as typeof base)).toBe(fingerprint(base));
  });

  it("ignora querystring e caminho da imagem, olha só o nome do arquivo", () => {
    const outroCdn = { ...base, imageSrc: "/assets/v2/t70p.webp" };
    expect(fingerprint(outroCdn)).toBe(fingerprint(base));
  });

  it("ignora diferença de espaço em branco e caixa no texto", () => {
    const espacado = { ...base, text: "  DJI   AGRAS\n T70P " };
    expect(fingerprint(espacado)).toBe(fingerprint(base));
  });

  it("muda quando o texto muda de verdade", () => {
    expect(fingerprint({ ...base, text: "DJI Agras T100" })).not.toBe(fingerprint(base));
  });

  it("muda quando a posição entre irmãos muda", () => {
    expect(fingerprint({ ...base, siblingIndex: 3 })).not.toBe(fingerprint(base));
  });

  it("funciona sem id, sem texto e sem imagem", () => {
    expect(fingerprint({ tag: "div", siblingIndex: 0 })).toHaveLength(16);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test src/fingerprint.test.ts`
Expected: FAIL — `Cannot find module './fingerprint.js'`.

- [ ] **Step 3: Implementar**

`apps/runner/src/fingerprint.ts`:

```ts
import { createHash } from "node:crypto";

export interface FingerprintInput {
  tag: string;
  id?: string;
  text?: string;
  imageSrc?: string;
  siblingIndex: number;
}

function normalizeText(text: string | undefined): string {
  if (!text) return "";
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
}

function imageBasename(src: string | undefined): string {
  if (!src) return "";
  const withoutQuery = src.split("?")[0] ?? "";
  return withoutQuery.split("/").pop() ?? "";
}

/**
 * Identidade de um nó que sobrevive à mudança de classe, de CDN e de
 * formatação. Classes CSS NÃO entram no hash de propósito: markup Tailwind
 * troca de classe a cada refactor sem o conteúdo mudar.
 */
export function fingerprint(input: FingerprintInput): string {
  const parts = [
    input.tag.toLowerCase(),
    input.id ?? "",
    normalizeText(input.text),
    imageBasename(input.imageSrc),
    String(input.siblingIndex),
  ];
  return createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 16);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test src/fingerprint.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/runner/src/fingerprint.ts apps/runner/src/fingerprint.test.ts
git commit -m "feat: fingerprint de nó estável a troca de classe e de CDN"
```

---

### Task 5: Extração da árvore de nós no browser

**Files:**

- Create: `apps/runner/src/extract.ts`
- Create: `apps/runner/src/testing/fixture-server.ts`
- Create: `apps/runner/src/testing/fixtures/home.html`
- Test: `apps/runner/src/extract.test.ts`

**Interfaces:**

- Consumes: `fingerprint`, `FingerprintInput` de Task 4.
- Produces:
  - `extractNodes(page: Page): Promise<SnapshotNode[]>` — nós com `fingerprint` já calculado, `box` em espaço de documento, `isSection` marcado. `screenshot` fica indefinido aqui; Task 7 preenche.
  - `startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }>` — sobe HTTP estático servindo `src/testing/fixtures/` numa porta livre.

**Regra de seção (determinística, sem IA):** o nó é seção quando a tag é `section`, `header`, `footer`, `article` ou `main`, **ou** é filho direto de `<main>`/`<body>`; **e** está visível; **e** tem altura ≥ 200px. Nada de `data-*` combinado com o alvo.

- [ ] **Step 1: Criar o fixture HTML**

`apps/runner/src/testing/fixtures/home.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Fixture — Home</title>
    <meta name="description" content="Página de teste do crawler" />
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        background: #0b0b0f;
        color: #fff;
        font-family: sans-serif;
      }
      section {
        padding: 40px;
      }
      #hero {
        height: 900px;
        background: #0b0b0f;
      }
      #sobre {
        height: 700px;
        background: #14141c;
      }
      #produtos {
        height: 1200px;
        background: #0b0b0f;
      }
      #contato {
        height: 800px;
        background: #14141c;
      }
      .escondida {
        display: none;
      }
      .rasa {
        height: 40px;
      }
    </style>
  </head>
  <body>
    <main>
      <section id="hero">
        <h1>Drones para o agronegócio</h1>
        <button id="cta">Falar no WhatsApp</button>
      </section>
      <section id="sobre">
        <h2>Sobre</h2>
        <p>Texto institucional.</p>
      </section>
      <section id="produtos">
        <h2>Produtos</h2>
        <article id="produto-a"><h3>DJI Agras T25P</h3></article>
        <article id="produto-b"><h3>DJI Agras T70P</h3></article>
      </section>
      <section id="contato">
        <h2>Contato</h2>
        <form><input name="nome" /><input name="email" /><button>Enviar</button></form>
      </section>
      <section id="oculta" class="escondida"><h2>Não deve aparecer</h2></section>
      <section id="rodape-fino" class="rasa"><span>rasa demais</span></section>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Criar o servidor de fixtures**

`apps/runner/src/testing/fixture-server.ts`:

```ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Servidor estático em porta livre, só para os testes de integração. */
export async function startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const requested = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"));
    const filePath = join(FIXTURES_DIR, requested === "/" ? "home.html" : requested);
    if (!filePath.startsWith(FIXTURES_DIR)) {
      res.writeHead(403).end();
      return;
    }
    stat(filePath)
      .then(() => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        createReadStream(filePath).pipe(res);
      })
      .catch(() => res.writeHead(404).end());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("servidor não subiu");

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
```

- [ ] **Step 3: Escrever o teste que falha**

`apps/runner/src/extract.test.ts`:

```ts
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractNodes } from "./extract.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let browser: Browser;
let server: Awaited<ReturnType<typeof startFixtureServer>>;
let nodes: Awaited<ReturnType<typeof extractNodes>>;

beforeAll(async () => {
  server = await startFixtureServer();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
  nodes = await extractNodes(page);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("extractNodes", () => {
  const sections = () => nodes.filter((n) => n.isSection);

  it("detecta as quatro seções reais da home", () => {
    expect(sections().map((n) => n.id)).toEqual(["hero", "sobre", "produtos", "contato"]);
  });

  it("não marca como seção o que está escondido", () => {
    expect(nodes.find((n) => n.id === "oculta")?.isSection).not.toBe(true);
  });

  it("não marca como seção o que é raso demais", () => {
    expect(nodes.find((n) => n.id === "rodape-fino")?.isSection).not.toBe(true);
  });

  it("usa coordenadas de documento, não de viewport", () => {
    const contato = sections().find((n) => n.id === "contato");
    expect(contato!.box.y).toBeGreaterThan(1080);
  });

  it("conta os elementos interativos da seção de contato", () => {
    const contato = sections().find((n) => n.id === "contato");
    expect(contato!.counts).toMatchObject({ inputs: 2, buttons: 1 });
  });

  it("dá a todo nó um nodeId único e um fingerprint", () => {
    const ids = new Set(nodes.map((n) => n.nodeId));
    expect(ids.size).toBe(nodes.length);
    expect(nodes.every((n) => n.fingerprint.length === 16)).toBe(true);
  });

  it("liga cada nó ao pai por parentId", () => {
    const produtos = nodes.find((n) => n.id === "produtos");
    const produtoB = nodes.find((n) => n.id === "produto-b");
    expect(produtoB!.parentId).toBe(produtos!.nodeId);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test src/extract.test.ts`
Expected: FAIL — `Cannot find module './extract.js'`.

- [ ] **Step 5: Implementar a extração**

`apps/runner/src/extract.ts`:

```ts
import type { SnapshotNode } from "@millead/video-contracts";
import type { Page } from "playwright";
import { fingerprint } from "./fingerprint.js";

const MIN_SECTION_HEIGHT = 200;
const SECTION_TAGS = new Set(["section", "header", "footer", "article", "main"]);

interface RawNode {
  path: number[];
  parentPath: number[] | null;
  tag: string;
  id?: string;
  classes: string[];
  role?: string;
  ariaLabel?: string;
  box: { x: number; y: number; w: number; h: number };
  visible: boolean;
  isStructural: boolean;
  text?: string;
  imageSrc?: string;
  media?: { type: "img" | "video"; src: string; naturalW: number; naturalH: number };
  counts: { images: number; videos: number; buttons: number; inputs: number; links: number };
  siblingIndex: number;
  selector: string;
}

/**
 * Percorre o DOM dentro do browser e devolve os nós candidatos com caixa em
 * ESPAÇO DE DOCUMENTO (getBoundingClientRect + scroll atual). O fingerprint é
 * calculado no Node, fora daqui: `node:crypto` não existe na página.
 */
export async function extractNodes(page: Page): Promise<SnapshotNode[]> {
  const raw: RawNode[] = await page.evaluate(() => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const out: RawNode[] = [];

    function cssSelector(el: Element): string {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      const index = Array.from(parent.children).indexOf(el) + 1;
      return `${cssSelector(parent)} > ${el.tagName.toLowerCase()}:nth-child(${index})`;
    }

    function walk(el: Element, path: number[], parentPath: number[] | null): void {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0;

      const parent = el.parentElement;
      const isDirectChildOfRoot =
        parent !== null && (parent.tagName === "MAIN" || parent.tagName === "BODY");

      const image = el.tagName === "IMG" ? (el as HTMLImageElement) : null;
      const video = el.tagName === "VIDEO" ? (el as HTMLVideoElement) : null;

      out.push({
        path,
        parentPath,
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: Array.from(el.classList),
        role: el.getAttribute("role") ?? undefined,
        ariaLabel: el.getAttribute("aria-label") ?? undefined,
        box: {
          x: rect.left + scrollX,
          y: rect.top + scrollY,
          w: rect.width,
          h: rect.height,
        },
        visible,
        isStructural: isDirectChildOfRoot,
        text: (el.textContent ?? "").slice(0, 400) || undefined,
        imageSrc: image?.currentSrc || image?.src || undefined,
        media: image
          ? {
              type: "img",
              src: image.currentSrc || image.src,
              naturalW: image.naturalWidth,
              naturalH: image.naturalHeight,
            }
          : video
            ? {
                type: "video",
                src: video.currentSrc || video.src,
                naturalW: video.videoWidth,
                naturalH: video.videoHeight,
              }
            : undefined,
        counts: {
          images: el.querySelectorAll("img").length,
          videos: el.querySelectorAll("video").length,
          buttons: el.querySelectorAll("button").length,
          inputs: el.querySelectorAll("input, textarea, select").length,
          links: el.querySelectorAll("a").length,
        },
        siblingIndex: parent ? Array.from(parent.children).indexOf(el) : 0,
        selector: cssSelector(el),
      });

      Array.from(el.children).forEach((child, index) => {
        walk(child, [...path, index], path);
      });
    }

    const root = document.querySelector("main") ?? document.body;
    walk(root, [0], null);
    return out;
  });

  const idByPath = new Map<string, string>();
  raw.forEach((node, index) => idByPath.set(node.path.join("."), `n${index}`));

  return raw.map((node, index) => {
    const isSection =
      // O nó raiz (o próprio <main>) nunca é seção: ele contém todas elas.
      node.parentPath !== null &&
      node.visible &&
      node.box.h >= MIN_SECTION_HEIGHT &&
      (SECTION_TAGS.has(node.tag) || node.isStructural);

    return {
      nodeId: `n${index}`,
      parentId: node.parentPath ? (idByPath.get(node.parentPath.join(".")) ?? null) : null,
      fingerprint: fingerprint({
        tag: node.tag,
        id: node.id,
        text: node.text,
        imageSrc: node.imageSrc,
        siblingIndex: node.siblingIndex,
      }),
      selector: node.selector,
      tag: node.tag,
      id: node.id,
      classes: node.classes,
      role: node.role,
      ariaLabel: node.ariaLabel,
      box: node.box,
      visible: node.visible,
      isSection,
      text: node.text,
      media: node.media,
      counts: node.counts,
    } satisfies SnapshotNode;
  });
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test src/extract.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 7: Commit**

```bash
git add apps/runner/src/extract.ts apps/runner/src/extract.test.ts apps/runner/src/testing
git commit -m "feat: extração da árvore de nós com caixas em espaço de documento"
```

---

### Task 6: Captura de tiles com lazy-load resolvido

**Files:**

- Create: `apps/runner/src/capture-tiles.ts`
- Test: `apps/runner/src/capture-tiles.test.ts`

**Interfaces:**

- Consumes: `startFixtureServer` de Task 5.
- Produces: `captureTiles(page: Page, outDir: string): Promise<Tile[]>` — grava `tiles/NNN-y<scrollY>.webp` dentro de `outDir` e devolve os `Tile` na ordem. Exporta `MAX_TILES = 40`. Task 8 consome.

**Por que tiles e não `fullPage: true`:** o screenshot de página inteira do Playwright rola a página por dentro e sai quebrado em site com `pin`/sticky — tombo já pago no kavita-institucional.

- [ ] **Step 1: Escrever o teste que falha**

`apps/runner/src/capture-tiles.test.ts`:

```ts
import { readdir } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureTiles } from "./capture-tiles.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let browser: Browser;
let server: Awaited<ReturnType<typeof startFixtureServer>>;
let outDir: string;
let tiles: Awaited<ReturnType<typeof captureTiles>>;

beforeAll(async () => {
  server = await startFixtureServer();
  browser = await chromium.launch();
  outDir = await mkdtemp(join(tmpdir(), "millead-tiles-"));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
  tiles = await captureTiles(page, outDir);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("captureTiles", () => {
  it("cobre a página inteira em passos de um viewport", () => {
    // A fixture tem 900+700+1200+800+40 px de seções, mais paddings: > 3 telas.
    expect(tiles.length).toBeGreaterThanOrEqual(4);
  });

  it("grava os arquivos em disco", async () => {
    const files = await readdir(join(outDir, "tiles"));
    expect(files).toHaveLength(tiles.length);
    expect(files.every((f) => f.endsWith(".jpg"))).toBe(true);
  });

  it("registra o scrollY de cada tile em ordem crescente", () => {
    const ys = tiles.map((t) => t.scrollY);
    expect(ys[0]).toBe(0);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it("devolve caminhos relativos ao pacote, não absolutos", () => {
    expect(tiles.every((t) => t.file.startsWith("tiles/"))).toBe(true);
  });

  it("deixa a página de volta no topo ao terminar", async () => {
    const page = browser.contexts()[0]!.pages()[0]!;
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test src/capture-tiles.test.ts`
Expected: FAIL — `Cannot find module './capture-tiles.js'`.

- [ ] **Step 3: Implementar**

`apps/runner/src/capture-tiles.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Tile } from "@millead/video-contracts";
import type { Page } from "playwright";

export const MAX_TILES = 40;
const SETTLE_MS = 250;

/** Rola até o fim e volta, forçando o lazy-load a resolver antes da captura. */
async function primeLazyLoad(page: Page, viewportHeight: number): Promise<void> {
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < pageHeight; y += viewportHeight) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(SETTLE_MS);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Captura a página em tiles de um viewport cada, gravando o scrollY junto.
 * NÃO usa `fullPage: true`: o screenshot de página inteira do Playwright rola
 * a página por dentro e sai quebrado em site com pin/sticky.
 */
export async function captureTiles(page: Page, outDir: string): Promise<Tile[]> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("a página não tem viewport definido");

  await mkdir(join(outDir, "tiles"), { recursive: true });
  await primeLazyLoad(page, viewport.height);

  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const tiles: Tile[] = [];

  for (let index = 0; index * viewport.height < pageHeight; index += 1) {
    if (index >= MAX_TILES) {
      throw new Error(
        `a página é alta demais: passou de ${MAX_TILES} telas (${MAX_TILES * viewport.height}px). ` +
          "Provavelmente tem scroll infinito.",
      );
    }
    const scrollY = index * viewport.height;
    await page.evaluate((top) => window.scrollTo(0, top), scrollY);
    await page.waitForTimeout(SETTLE_MS);

    // `.jpg`, não `.webp`: o page.screenshot do Playwright só escreve PNG e
    // JPEG. Qualidade 90 é de sobra para tile de referência e pesa bem menos
    // que PNG. A spec ainda diz .webp -- corrigida na Task 10, Step 4.
    const file = `tiles/${String(index).padStart(3, "0")}-y${scrollY}.jpg`;
    await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 90 });
    tiles.push({ file, scrollY, height: viewport.height });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return tiles;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test src/capture-tiles.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/runner/src/capture-tiles.ts apps/runner/src/capture-tiles.test.ts
git commit -m "feat: captura em tiles com lazy-load resolvido antes"
```

---

### Task 7: Miniatura por seção

**Files:**

- Create: `apps/runner/src/capture-sections.ts`
- Test: `apps/runner/src/capture-sections.test.ts`

**Interfaces:**

- Consumes: `SnapshotNode` de Task 1, `extractNodes` de Task 5.
- Produces: `captureSections(page: Page, nodes: SnapshotNode[], outDir: string): Promise<SnapshotNode[]>` — devolve os nós com `screenshot` preenchido nas seções. Task 8 consome.

**Por que a miniatura não é recorte do tile:** elemento que atravessa a fronteira de dois tiles sairia cortado. A foto é tirada do próprio elemento, depois de `scrollIntoView`.

- [ ] **Step 1: Escrever o teste que falha**

`apps/runner/src/capture-sections.test.ts`:

```ts
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureSections } from "./capture-sections.js";
import { extractNodes } from "./extract.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let browser: Browser;
let server: Awaited<ReturnType<typeof startFixtureServer>>;
let outDir: string;
let nodes: Awaited<ReturnType<typeof captureSections>>;

beforeAll(async () => {
  server = await startFixtureServer();
  browser = await chromium.launch();
  outDir = await mkdtemp(join(tmpdir(), "millead-sections-"));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
  nodes = await captureSections(page, await extractNodes(page), outDir);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("captureSections", () => {
  it("preenche screenshot em toda seção", () => {
    const sections = nodes.filter((n) => n.isSection);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((n) => typeof n.screenshot === "string")).toBe(true);
  });

  it("não põe screenshot em nó que não é seção", () => {
    expect(nodes.filter((n) => !n.isSection).every((n) => n.screenshot === undefined)).toBe(true);
  });

  it("nomeia o arquivo pelo id do elemento quando existe", () => {
    const hero = nodes.find((n) => n.id === "hero");
    expect(hero!.screenshot).toBe("sections/hero.jpg");
  });

  it("grava um arquivo por seção", async () => {
    const files = await readdir(join(outDir, "sections"));
    expect(files).toHaveLength(nodes.filter((n) => n.isSection).length);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test src/capture-sections.test.ts`
Expected: FAIL — `Cannot find module './capture-sections.js'`.

- [ ] **Step 3: Implementar**

`apps/runner/src/capture-sections.ts`:

```ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SnapshotNode } from "@millead/video-contracts";
import type { Page } from "playwright";

const SETTLE_MS = 250;

function slugFor(node: SnapshotNode, index: number): string {
  const base = node.id ?? `${node.tag}-${index}`;
  return base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acento; escape explícito evita problema de encoding
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Fotografa cada seção a partir do próprio elemento (scroll into view + settle),
 * nunca recortando o tile: elemento que atravessa a fronteira de dois tiles
 * sairia cortado.
 */
export async function captureSections(
  page: Page,
  nodes: SnapshotNode[],
  outDir: string,
): Promise<SnapshotNode[]> {
  await mkdir(join(outDir, "sections"), { recursive: true });
  const result: SnapshotNode[] = [];

  for (const [index, node] of nodes.entries()) {
    if (!node.isSection) {
      result.push(node);
      continue;
    }

    const file = `sections/${slugFor(node, index)}.jpg`;
    const locator = page.locator(node.selector).first();
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await page.waitForTimeout(SETTLE_MS);
      await locator.screenshot({ path: join(outDir, file), type: "jpeg", quality: 90 });
      result.push({ ...node, screenshot: file });
    } catch {
      // Seletor frágil ou elemento fora de alcance: degrada para nó comum em
      // vez de derrubar a captura inteira. O schema exige screenshot em seção,
      // então o nó deixa de ser seção.
      result.push({ ...node, isSection: false });
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return result;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test src/capture-sections.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/runner/src/capture-sections.ts apps/runner/src/capture-sections.test.ts
git commit -m "feat: miniatura por seção tirada do próprio elemento"
```

---

### Task 8: Montagem e escrita atômica do pacote

**Files:**

- Create: `apps/runner/src/build-snapshot.ts`
- Create: `apps/runner/src/write-package.ts`
- Test: `apps/runner/src/write-package.test.ts`

**Interfaces:**

- Consumes: `SnapshotSchema`, `Snapshot`, `SnapshotNode`, `Tile` (Task 1); `captureTiles` (Task 6); `captureSections` (Task 7); `extractNodes` (Task 5).
- Produces:
  - `buildSnapshotId(url: URL, capturedAt: string): string`
  - `capturePage(page, opts: { url: URL; capturedAt: string; outDir: string }): Promise<Snapshot>`
  - `writePackage(snapshot: Snapshot, tmpDir: string, capturesRoot: string): Promise<string>` — valida no zod, escreve `snapshot.json`, renomeia o temporário e devolve o caminho final.

**Regra:** pacote parcial nunca existe. Tudo é escrito em `captures/.tmp-<id>/` e só vira `captures/<id>/` depois que o zod aprovar.

- [ ] **Step 1: Escrever o teste que falha**

`apps/runner/src/write-package.test.ts`:

```ts
import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSnapshotId } from "./build-snapshot.js";
import { writePackage } from "./write-package.js";

function snapshotBase(id: string) {
  return {
    version: 1 as const,
    id,
    url: "https://milweb.com.br/",
    capturedAt: "2026-07-29T14:32:00.000Z",
    http: { status: 200, finalUrl: "https://milweb.com.br/", redirects: [] },
    page: { title: "MilWeb", description: "", lang: "pt-BR" },
    capture: {
      viewport: { width: 1920, height: 1080, dpr: 1 },
      userAgent: "MilLeadVideoBot/1.0",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      pageHeight: 2160,
      tiles: [{ file: "tiles/000-y0.jpg", scrollY: 0, height: 1080 }],
    },
    theme: { colors: [] },
    warnings: [],
    nodes: [],
  };
}

describe("buildSnapshotId", () => {
  it("é determinístico e inclui host, caminho, viewport e instante", () => {
    const id = buildSnapshotId(new URL("https://milweb.com.br/"), "2026-07-29T14:32:00.000Z");
    expect(id).toBe("milweb.com.br-home-desktop-202607291432");
    expect(id).toBe(buildSnapshotId(new URL("https://milweb.com.br/"), "2026-07-29T14:32:00.000Z"));
  });

  it("transforma o caminho em slug", () => {
    const id = buildSnapshotId(
      new URL("https://milweb.com.br/cases/kavita"),
      "2026-07-29T14:32:00.000Z",
    );
    expect(id).toContain("cases-kavita");
  });
});

describe("writePackage", () => {
  it("renomeia o temporário para o diretório final quando o zod aprova", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "milweb.com.br-home-desktop-202607291432";
    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(join(tmpDir, "tiles"), { recursive: true });
    await writeFile(join(tmpDir, "tiles", "000-y0.jpg"), "fake");

    const finalDir = await writePackage(snapshotBase(id), tmpDir, root);

    expect(finalDir).toBe(join(root, id));
    const files = await readdir(finalDir);
    expect(files).toContain("snapshot.json");
    expect(files).toContain("tiles");
    expect(await readdir(root)).not.toContain(`.tmp-${id}`);
  });

  it("não deixa nada para trás quando a validação falha", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "quebrado";
    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(tmpDir, { recursive: true });

    const invalid = { ...snapshotBase(id), version: 99 } as unknown as Parameters<
      typeof writePackage
    >[0];

    await expect(writePackage(invalid, tmpDir, root)).rejects.toThrow(/snapshot inválido/i);
    expect(await readdir(root)).toEqual([]);
  });

  it("grava o snapshot.json indentado e reparseável", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "milweb.com.br-home-desktop-202607291432";
    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(tmpDir, { recursive: true });

    const finalDir = await writePackage(snapshotBase(id), tmpDir, root);
    const parsed = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    expect(parsed.id).toBe(id);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test src/write-package.test.ts`
Expected: FAIL — módulos `./build-snapshot.js` e `./write-package.js` não existem.

- [ ] **Step 3: Implementar `build-snapshot.ts`**

```ts
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

/** "milweb.com.br-home-desktop-202607291432" — derivado, sem Date.now(). */
export function buildSnapshotId(url: URL, capturedAt: string): string {
  const stamp = capturedAt.replace(/[-:]/g, "").replace(/T/, "").slice(0, 12);
  return `${url.hostname}-${slugPath(url.pathname)}-desktop-${stamp}`;
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
```

- [ ] **Step 4: Implementar `write-package.ts`**

```ts
import { rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SnapshotSchema, type Snapshot } from "@millead/video-contracts";

/**
 * Pacote parcial nunca existe: escreve no temporário, valida, e só então
 * renomeia. Falhou a validação, o temporário é apagado inteiro.
 */
export async function writePackage(
  snapshot: Snapshot,
  tmpDir: string,
  capturesRoot: string,
): Promise<string> {
  const parsed = SnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    await rm(tmpDir, { recursive: true, force: true });
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`snapshot inválido -- nada foi gravado:\n${detail}`);
  }

  await writeFile(
    join(tmpDir, "snapshot.json"),
    `${JSON.stringify(parsed.data, null, 2)}\n`,
    "utf8",
  );

  const finalDir = join(capturesRoot, parsed.data.id);
  await rm(finalDir, { recursive: true, force: true });
  await rename(tmpDir, finalDir);
  return finalDir;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test src/write-package.test.ts`
Expected: PASS — 5 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/runner/src/build-snapshot.ts apps/runner/src/write-package.ts apps/runner/src/write-package.test.ts
git commit -m "feat: montagem do snapshot e escrita atômica do pacote"
```

---

### Task 9: CLI, README e integração ponta a ponta

**Files:**

- Create: `apps/runner/src/cli.ts`
- Create: `apps/runner/README.md`
- Create: `apps/runner/.gitignore`
- Test: `apps/runner/src/cli.test.ts`
- Modify: `package.json` (raiz) — adicionar o script `capture`

**Interfaces:**

- Consumes: `assertPublicUrl` (Task 3), `capturePage`/`buildSnapshotId`/`USER_AGENT`/`LOCALE`/`TIMEZONE` (Task 8), `writePackage` (Task 8).
- Escreve também o `dom.html` (body cru da resposta) dentro do pacote — é o único arquivo do pacote que não vem do `capturePage`.
- Produces: `runCapture(rawUrl: string, opts: { capturedAt: string; capturesRoot: string; allowPrivate?: boolean }): Promise<string>` — o caminho do pacote final. O `main()` do CLI só lê `process.argv`, chama isso e trata o código de saída.

- [ ] **Step 1: Escrever o teste de integração ponta a ponta**

`apps/runner/src/cli.test.ts`:

```ts
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SnapshotSchema } from "@millead/video-contracts";
import { runCapture } from "./cli.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let server: Awaited<ReturnType<typeof startFixtureServer>>;
let capturesRoot: string;
let finalDir: string;

beforeAll(async () => {
  server = await startFixtureServer();
  capturesRoot = await mkdtemp(join(tmpdir(), "millead-captures-"));
  finalDir = await runCapture(`${server.url}/home.html`, {
    capturedAt: "2026-07-29T14:32:00.000Z",
    capturesRoot,
    allowPrivate: true,
  });
});

afterAll(async () => {
  await server?.close();
});

describe("runCapture", () => {
  it("produz um pacote que valida no schema", async () => {
    const json = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    expect(() => SnapshotSchema.parse(json)).not.toThrow();
  });

  it("grava snapshot.json, dom.html, tiles e sections", async () => {
    const files = await readdir(finalDir);
    expect(files).toEqual(
      expect.arrayContaining(["snapshot.json", "dom.html", "tiles", "sections"]),
    );
  });

  it("guarda o HTML servido cru, para reprocessar sem reabrir o site", async () => {
    const html = await readFile(join(finalDir, "dom.html"), "utf8");
    expect(html).toContain('id="produtos"');
  });

  it("identifica as seções da fixture", async () => {
    const json = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    const ids = json.nodes
      .filter((n: { isSection: boolean }) => n.isSection)
      .map((n: { id: string }) => n.id);
    expect(ids).toEqual(["hero", "sobre", "produtos", "contato"]);
  });

  it("é determinístico: dois capturas iguais só diferem em id e capturedAt", async () => {
    const outro = await runCapture(`${server.url}/home.html`, {
      capturedAt: "2026-07-29T15:00:00.000Z",
      capturesRoot,
      allowPrivate: true,
    });
    const a = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    const b = JSON.parse(await readFile(join(outro, "snapshot.json"), "utf8"));
    delete a.id;
    delete a.capturedAt;
    delete a.url;
    delete a.http;
    delete a.capture.tiles;
    delete b.id;
    delete b.capturedAt;
    delete b.url;
    delete b.http;
    delete b.capture.tiles;
    expect(b).toEqual(a);
  });

  it("recusa alvo interno quando allowPrivate está desligado", async () => {
    await expect(
      runCapture(`${server.url}/home.html`, {
        capturedAt: "2026-07-29T15:00:00.000Z",
        capturesRoot,
      }),
    ).rejects.toThrow(/interno/i);
  });

  it("falha com mensagem clara quando a página não existe", async () => {
    await expect(
      runCapture(`${server.url}/nao-existe.html`, {
        capturedAt: "2026-07-29T15:00:00.000Z",
        capturesRoot,
        allowPrivate: true,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/runner test src/cli.test.ts`
Expected: FAIL — `Cannot find module './cli.js'`.

- [ ] **Step 3: Implementar o CLI**

`apps/runner/src/cli.ts`:

```ts
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { LOCALE, TIMEZONE, USER_AGENT, buildSnapshotId, capturePage } from "./build-snapshot.js";
import { assertPublicUrl } from "./url-guard.js";
import { writePackage } from "./write-package.js";

const NAV_TIMEOUT_MS = 30_000;

export async function runCapture(
  rawUrl: string,
  opts: { capturedAt: string; capturesRoot: string; allowPrivate?: boolean },
): Promise<string> {
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/runner test src/cli.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Ignorar as capturas no git**

`apps/runner/.gitignore`:

```
captures/
```

- [ ] **Step 6: Escrever o README**

`apps/runner/README.md`:

````markdown
# @millead/runner

Crawler do Video Studio. Abre uma URL, captura a página em tiles e miniaturas de
seção, e grava um pacote validado pelos contratos de `@millead/video-contracts`.

## Pré-requisito: baixar o Chromium

O download do browser **não** acontece no `pnpm install`. A raiz do monorepo usa
`onlyBuiltDependencies` (pnpm 10) e o `playwright` não está na lista — de
propósito. Rode uma vez:

```bash
pnpm --filter @millead/runner exec playwright install chromium
```

> **Nunca adicione `playwright` ao `onlyBuiltDependencies` do `package.json` da
> raiz.** O `render.yaml` roda `pnpm install` na raiz; a allowlist é o que
> impede o free tier do Render de tentar baixar ~150 MB de browser e quebrar o
> build da API em produção.

## Uso

```bash
pnpm capture https://milweb.com.br
```

Saída: `apps/runner/captures/<snapshotId>/` com `snapshot.json`, `tiles/` e
`sections/`. O diretório `captures/` é ignorado pelo git.

## Alvos internos

Por padrão o crawler recusa `localhost` e IP privado — a guarda de SSRF roda
antes do `page.goto`, porque o Playwright não passa pelo `safe-fetch` da API.
Os testes de integração precisam de `127.0.0.1`, então existe a saída:

```bash
VIDEO_RUNNER_ALLOW_PRIVATE=1 pnpm capture http://127.0.0.1:4321
```

Isso é recurso de teste. Não ligue essa variável em nada que aceite URL de
terceiro.

## Testes

```bash
pnpm --filter @millead/runner test
```

Rodam offline, contra um servidor de fixtures em `src/testing/fixtures/`.
**milweb.com.br não entra no CI** — site muda, rede falha, e teste intermitente
é pior que teste nenhum.
````

- [ ] **Step 7: Adicionar o atalho na raiz**

Em `package.json` (raiz), dentro de `"scripts"`, logo após `"dev:web"`:

```json
    "capture": "pnpm --filter @millead/runner run capture",
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `pnpm test && pnpm type-check && pnpm lint`
Expected: PASS em todos os workspaces. Se o turbo reclamar de `test` sem `build` no runner, confirme que `apps/runner/package.json` não declara `build` — a task `test` do `turbo.json` depende de `^build` (dependências), não de um `build` próprio.

- [ ] **Step 9: Commit**

```bash
git add apps/runner package.json
git commit -m "feat: CLI de captura, README e integração ponta a ponta"
```

---

### Task 10: Fumaça contra milweb.com.br e verificação visual

**Files:**

- Modify: `docs/superpowers/specs/2026-07-29-video-studio-contratos-design.md` (registrar `.jpg` no lugar de `.webp`)
- Create: `docs/superpowers/plans/2026-07-29-video-studio-contratos-resultado.md`

**Interfaces:**

- Consumes: o CLI de Task 9.
- Produces: nada de código. Produz a evidência de que o critério de aceite da spec foi cumprido.

**Esta task não pode ser marcada como concluída sem que alguém tenha OLHADO as imagens.** Captura de site com scroll animado é exatamente o caso em que tudo passa no código e o resultado visual está quebrado.

- [ ] **Step 1: Rodar contra o alvo real**

Run: `pnpm capture https://milweb.com.br`
Expected: `pacote gravado em .../apps/runner/captures/milweb.com.br-home-desktop-<stamp>`

- [ ] **Step 2: Conferir o pacote**

Run:

```bash
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8');const j=JSON.parse(s);console.log('seções:',j.nodes.filter(n=>n.isSection).map(n=>n.id||n.tag).join(', '));console.log('tiles:',j.capture.tiles.length);console.log('avisos:',j.warnings)" apps/runner/captures/<id>/snapshot.json
```

Expected: lista de seções da home da MilWeb, contagem de tiles coerente com a altura da página, `avisos: []`.

- [ ] **Step 3: Verificação visual — obrigatória**

Abrir **todos** os arquivos de `tiles/` e de `sections/` e olhar. Checar:

1. Nenhum tile em branco ou com imagem faltando (falha de lazy-load).
2. Nenhum tile com conteúdo duplicado ou header fantasma repetido (sintoma de sticky/pin atrapalhando).
3. As miniaturas de seção correspondem às seções que o `snapshot.json` nomeou.
4. As caixas batem: pegar a `box` de uma seção no JSON e confirmar, a olho, que aquele `y` cai no tile esperado (`tile = floor(box.y / 1080)`).

Se qualquer um falhar, **isso é um bug de captura, não um detalhe** — corrija antes de seguir.

- [ ] **Step 4: Corrigir a spec (`.webp` → `.jpg`)**

Em `docs/superpowers/specs/2026-07-29-video-studio-contratos-design.md`, na árvore do pacote de captura, trocar as três ocorrências de `.webp` por `.jpg` e acrescentar a linha abaixo logo depois da árvore:

```markdown
> Formato: `.jpg` com qualidade 90. O `page.screenshot` do Playwright só escreve
> PNG e JPEG — WebP exigiria um passo de conversão que não se paga para imagem
> de referência.
```

- [ ] **Step 5: Registrar o resultado**

Criar `docs/superpowers/plans/2026-07-29-video-studio-contratos-resultado.md` com:

```markdown
# Resultado — contratos e crawler do Video Studio

Data: <preencher com a data da execução>

## Critério de aceite da spec

| #   | Critério                                         | Status | Evidência               |
| --- | ------------------------------------------------ | ------ | ----------------------- |
| 1   | Pacote de milweb.com.br valida no zod            |        |                         |
| 2   | Seções da home identificadas                     |        | seções encontradas: ... |
| 3   | Caixas conferem com os tiles a olho nu           |        | conferido em: ...       |
| 4   | Duas execuções diferem só em `id` e `capturedAt` |        |                         |

## O que o crawler ainda erra em milweb.com.br

<preencher — é a entrada da próxima fatia>

## Teste contra site de terceiro

Alvo: <preencher>
O que quebrou: <preencher>
```

Preencher com o resultado real, incluindo o que deu errado.

- [ ] **Step 6: Rodar contra um site que ninguém aqui escreveu**

Escolher um site de terceiro qualquer, rodar a captura e anotar o que quebra na seção correspondente do documento de resultado. Não corrigir agora — o objetivo é medir o quanto o crawler depende de markup familiar. Se ele só funciona em site da MilWeb, isso precisa estar escrito antes de alguém construir o Inspector em cima.

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers
git commit -m "docs: resultado da captura real e correção de formato na spec"
```

---

## Notas de execução

**Ordem obrigatória:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. As Tasks 5–9 dependem em cadeia; 1–4 podem ser feitas em paralelo se houver mais de um executor (1 e 2 no pacote de contratos, 3 e 4 no runner).

**Se um teste de integração pendurar:** o Chromium provavelmente ficou vivo. `taskkill /F /IM chrome.exe` no Windows, e confirme que o `finally` com `browser.close()` está no lugar.

**Fora deste plano** (está na spec, seção "Fora de escopo"): Inspector visual, timeline, preview, o passo Designer com Claude, Remotion, narração, legendas, viewport mobile, Vercel Blob, Prisma, templates de campanha e o formato `.mlvideo` importável.
