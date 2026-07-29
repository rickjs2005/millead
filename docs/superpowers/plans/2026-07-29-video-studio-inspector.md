# Video Studio — Inspector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lista de cenas da tela `/videos` passa a vir do Snapshot do crawler — seções reais com miniatura, e alvos de zoom que são elementos de verdade, com a caixa medida.

**Architecture:** O contrato `VideoBrief` troca `slot` (enum fechado) por `sectionId` livre + `zoomTargets` com caixa. Duas funções puras derivam seções e candidatos de zoom a partir do Snapshot; uma terceira casa os templates com o que foi encontrado. A tela ganha um passo de ingestão do Snapshot por upload de pasta, client-side.

**Tech Stack:** TypeScript 5.7, zod 3.24, Next 15 (client component), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-video-studio-inspector-design.md`

## Global Constraints

- **zod `^3.24.1`** — `overrides` na raiz; zod 4 proibido.
- `packages/video-contracts` é ESM/NodeNext (imports relativos com `.js`). No `apps/web` os imports **não** levam extensão e usam alias `@/`.
- Testes colocados como `src/**/*.test.ts`, Vitest `environment: "node"`. **Só funções puras têm teste** — sem jsdom, sem teste de componente React.
- Textos de tela e mensagens de erro **em português**.
- Determinismo: proibido `Date.now()` e `Math.random()` nas funções puras. Só a página (borda) chama `new Date()`.
- **Nenhuma dependência nova.** Componentes disponíveis em `components/ui/`: avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, input, label, pagination, popover, progress, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, tooltip.
- Não criar rota de API, não mexer em Prisma, não adicionar variável de ambiente.
- Branch: `feat/video-studio-inspector`.
- Commits em português, prefixo `feat:` / `fix:` / `test:` / `docs:`.

**Fixture já criada e disponível:** `apps/web/src/features/video-studio/testing/snapshot-milweb.json` — Snapshot REAL do milweb.com.br, reduzido a 4 seções (`top`, uma sem id, `raio-x`, `contact`) e 449 nós. É markup que ninguém escreveu para estes testes, e é de propósito.

---

### Task 1: Contrato — cena de site com realidade

**Files:**
- Modify: `packages/video-contracts/src/brief.ts`
- Test: `packages/video-contracts/src/brief.test.ts`

**Interfaces:**
- Produces: `ZoomTargetSchema`/`ZoomTarget`; `BriefScene` com a variante de site nova. `SITE_SLOTS` e `SiteSlot` são **removidos**.

- [ ] **Step 1: Escrever os testes que falham**

Em `brief.test.ts`, substitua a cena de site do `validBrief()` por:

```ts
      {
        id: "sc3",
        kind: "site" as const,
        source: { snapshotId: "milweb.com.br-home-desktop-20260729000000-abc123", nodeId: "n7" },
        sectionId: "raio-x",
        label: "Raio-X do seu site",
        screenshot: "sections/raio-x.jpg",
        durationSec: 8,
        zoomTargets: [
          { nodeId: "n12", label: 'Botão "Gerar meu diagnóstico"', box: { x: 300, y: 3400, w: 260, h: 48 } },
        ],
      },
```

E acrescente:

```ts
  it("aceita cena de site sem miniatura", () => {
    const brief = validBrief();
    (brief.scenes[2] as Record<string, unknown>).screenshot = null;
    expect(() => VideoBriefSchema.parse(brief)).not.toThrow();
  });

  it("recusa cena de site sem sectionId", () => {
    const brief = validBrief();
    delete (brief.scenes[2] as Record<string, unknown>).sectionId;
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });

  it("recusa alvo de zoom sem caixa", () => {
    const brief = validBrief();
    const alvo = (brief.scenes[2] as { zoomTargets: Record<string, unknown>[] }).zoomTargets[0]!;
    delete alvo.box;
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });

  it("recusa caixa de zoom com largura negativa", () => {
    const brief = validBrief();
    const alvo = (brief.scenes[2] as { zoomTargets: { box: { w: number } }[] }).zoomTargets[0]!;
    alvo.box.w = -1;
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/video-contracts test src/brief.test.ts`
Expected: FAIL — o schema atual exige `slot` e rejeita `sectionId`.

- [ ] **Step 3: Trocar o schema**

Em `brief.ts`: remova `SITE_SLOTS`, `SiteSlotSchema` e o tipo `SiteSlot`. Acrescente e troque:

```ts
export const ZoomTargetSchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().min(1),
  /** Caixa em espaço de DOCUMENTO, medida pelo crawler. É o que faz o zoom mirar. */
  box: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().nonnegative(),
    h: z.number().nonnegative(),
  }),
});

const SiteSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("site"),
  /** De onde a cena veio: o Snapshot e o nó da seção. */
  source: z.object({ snapshotId: z.string().min(1), nodeId: z.string().min(1) }),
  /** Id real da seção no site ("raio-x"), não um slot de catálogo. */
  sectionId: z.string().min(1),
  /** O que a pessoa lê na tela. */
  label: z.string().min(1),
  /** Caminho da miniatura dentro do pacote, quando a captura trouxe. */
  screenshot: z.string().min(1).nullable(),
  durationSec: z.number().int("a duração da cena precisa ser em segundos inteiros").positive(),
  zoomTargets: z.array(ZoomTargetSchema),
  note: z.string().optional(),
});

export type ZoomTarget = z.infer<typeof ZoomTargetSchema>;
```

- [ ] **Step 4: Rodar, ver passar, e conferir o resto do pacote**

Run: `pnpm --filter @millead/video-contracts test && pnpm --filter @millead/video-contracts type-check && pnpm --filter @millead/video-contracts lint`
Expected: PASS. O `project.ts` e o `manifest.ts` não referenciam `SiteSlot` — se o type-check acusar algo, corrija e registre no relatório.

- [ ] **Step 5: Commit**

```bash
git add packages/video-contracts
git commit -m "feat: cena de site carrega seção real e caixa de zoom medida"
```

---

### Task 2: `sectionsFromSnapshot` e `zoomCandidatesFor`

**Files:**
- Create: `apps/web/src/features/video-studio/from-snapshot.ts`
- Test: `apps/web/src/features/video-studio/from-snapshot.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `SnapshotNode`, `ZoomTarget` de `@millead/video-contracts`.
- Produces:
  - `SnapshotSection { nodeId, sectionId, label, screenshot: string | null, box }`
  - `sectionsFromSnapshot(snapshot: Snapshot): SnapshotSection[]`
  - `zoomCandidatesFor(snapshot: Snapshot, sectionNodeId: string): ZoomTarget[]`

**Regras (da spec):**

`sectionsFromSnapshot` — nós com `isSection: true`, ordenados por `box.y`. `sectionId` é o `id` do elemento; sem id, slug do primeiro heading contido; sem heading, `secao-<n>` pelo índice. Único dentro do snapshot. `label` é o texto do primeiro heading; sem heading, o `sectionId`.

`zoomCandidatesFor` — nós contidos na caixa da seção (`n.box.y >= sec.box.y - 1` e `n.box.y + n.box.h <= sec.box.y + sec.box.h + 1`), excluindo a própria seção. Elegíveis: `h1|h2|h3|button|form|img|video`, mais `a` com `box.h >= 32`. Filtros: `visible`, `box.w >= 40`, `box.h >= 20`. Rótulo: texto quando houver — `Botão "Gerar meu diagnóstico"`, `Título "Seu site pode ser…"` — senão o tipo (`Imagem`, `Vídeo`, `Formulário`, `Link`). Ordem: títulos, depois ação (`button`/`a`/`form`), depois mídia; dentro de cada grupo, por `box.y`. **Teto de 8.**

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import { sectionsFromSnapshot, zoomCandidatesFor } from "./from-snapshot";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "testing",
  "snapshot-milweb.json",
);
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));

describe("sectionsFromSnapshot", () => {
  const secoes = sectionsFromSnapshot(snapshot);

  it("acha as seções reais do site, na ordem da página", () => {
    expect(secoes.map((s) => s.sectionId).slice(0, 2)).toEqual(["top", expect.any(String)]);
    expect(secoes.map((s) => s.sectionId)).toContain("raio-x");
    expect(secoes.map((s) => s.sectionId)).toContain("contact");
  });

  it("ordena por posição na página", () => {
    const ys = secoes.map((s) => s.box.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it("dá sectionId único a toda seção, inclusive à que não tem id no HTML", () => {
    const ids = secoes.map((s) => s.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("usa o texto do heading como label quando existe", () => {
    const top = secoes.find((s) => s.sectionId === "top")!;
    expect(top.label.toLowerCase()).toContain("seu site pode ser");
  });

  it("aponta a miniatura quando a captura trouxe", () => {
    const top = secoes.find((s) => s.sectionId === "top")!;
    expect(top.screenshot).toBe("sections/top.jpg");
  });
});

describe("zoomCandidatesFor", () => {
  const secoes = sectionsFromSnapshot(snapshot);
  const top = secoes.find((s) => s.sectionId === "top")!;
  const raioX = secoes.find((s) => s.sectionId === "raio-x")!;

  it("acha os elementos reais do hero, com rótulo legível", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    const rotulos = alvos.map((a) => a.label).join(" | ");
    expect(rotulos).toMatch(/Falar no WhatsApp/);
    expect(rotulos).toMatch(/Ver projetos/);
  });

  it("acha o botão de ação da seção raio-x", () => {
    const alvos = zoomCandidatesFor(snapshot, raioX.nodeId);
    expect(alvos.map((a) => a.label).join(" | ")).toMatch(/diagn/i);
  });

  it("traz a caixa medida junto de cada alvo", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    expect(alvos.every((a) => a.box.w > 0 && a.box.h > 0)).toBe(true);
  });

  it("só devolve elemento contido na seção", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    expect(
      alvos.every((a) => a.box.y >= top.box.y - 1 && a.box.y + a.box.h <= top.box.y + top.box.h + 1),
    ).toBe(true);
  });

  it("põe título antes de ação e de mídia", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    expect(alvos[0]!.label).toMatch(/^Título/);
  });

  it("nunca devolve mais de 8 alvos", () => {
    for (const secao of secoes) {
      expect(zoomCandidatesFor(snapshot, secao.nodeId).length).toBeLessThanOrEqual(8);
    }
  });

  it("devolve lista vazia para seção sem candidato", () => {
    const semCandidato = secoes.find((s) => zoomCandidatesFor(snapshot, s.nodeId).length === 0);
    expect(semCandidato).toBeTruthy();
  });

  it("devolve lista vazia para nodeId que não existe", () => {
    expect(zoomCandidatesFor(snapshot, "nao-existe")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/web test src/features/video-studio/from-snapshot.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `from-snapshot.ts`**

Escreva as duas funções seguindo as regras acima. Pontos de atenção:

- O slug segue o mesmo padrão do resto do módulo: minúsculas, `normalize("NFD")`, remoção de diacríticos, `[^a-z0-9]+` → `-`, corte das pontas.
- Unicidade do `sectionId` com um `Set`, sufixando com o índice em caso de colisão — mesmo padrão do `slugUnico` do crawler.
- "Primeiro heading contido" = o nó `h1|h2|h3` de menor `box.y` dentro da caixa da seção.
- O rótulo trunca o texto em 40 caracteres com reticências, para caber no chip.

- [ ] **Step 4: Rodar, ver passar**

Run: `pnpm --filter @millead/web test src/features/video-studio/from-snapshot.test.ts`
Expected: PASS.

> Se algum teste falhar por causa dos dados reais da fixture (ex.: o `top` não tiver heading), **não enfraqueça o teste** — investigue o Snapshot, ajuste a regra de derivação e registre no relatório o que os dados reais mostraram.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/video-studio
git commit -m "feat: deriva seções e alvos de zoom a partir do Snapshot"
```

---

### Task 3: Templates viram sugestão

**Files:**
- Modify: `apps/web/src/features/video-studio/templates.ts`
- Modify: `apps/web/src/features/video-studio/types.ts`
- Create: `apps/web/src/features/video-studio/match-template.ts`
- Test: `apps/web/src/features/video-studio/match-template.test.ts`
- Modify: `apps/web/src/features/video-studio/templates.test.ts`

**Interfaces:**
- Produces: `matchTemplate(template, sections): { scenes: FormScene[]; naoEncontrados: string[] }`.

**O que muda nos tipos:** `FormScene` da variante de site troca `slot?: SiteSlot` por `sectionId?: string`, `label?: string`, `screenshot?: string | null`, `sourceNodeId?: string`, e `zoomTargets` passa a ser `ZoomTarget[]` (com caixa) em vez de `string[]`.

**O que muda nos templates:** `defaultScenes` deixa de citar slots de site. Cada template passa a declarar `wants: { chave: string; palavras: string[]; durationSec: number }[]` para as cenas de site, e mantém as cenas de estúdio como estão (elas não dependem do site).

Exemplo para o Institucional:

```ts
    wants: [
      { chave: "Hero", palavras: ["top", "hero", "inicio", "home"], durationSec: 6 },
      { chave: "Sobre", palavras: ["about", "sobre", "quem"], durationSec: 5 },
      { chave: "Serviços", palavras: ["servic", "services", "deliverable", "entrego", "solucao"], durationSec: 6 },
      { chave: "Contato", palavras: ["contact", "contato", "formulario", "fale"], durationSec: 3 },
    ],
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import { sectionsFromSnapshot } from "./from-snapshot";
import { matchTemplate } from "./match-template";
import { templateById } from "./templates";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "testing", "snapshot-milweb.json");
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));
const secoes = sectionsFromSnapshot(snapshot);

describe("matchTemplate", () => {
  it("casa o hero do template com a seção top do site", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    const site = scenes.filter((s) => s.kind === "site");
    expect(site.map((s) => s.sectionId)).toContain("top");
  });

  it("casa contato com a seção contact", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    expect(scenes.map((s) => s.sectionId)).toContain("contact");
  });

  it("relata o que o template pediu e o site não tem", () => {
    const { naoEncontrados } = matchTemplate(templateById("portfolio")!, secoes);
    // A fixture tem 4 seções; um template de portfólio pede mais que isso.
    expect(naoEncontrados.length).toBeGreaterThan(0);
    expect(naoEncontrados.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
  });

  it("nunca inventa seção que não existe no site", () => {
    const { scenes } = matchTemplate(templateById("portfolio")!, secoes);
    const idsReais = new Set(secoes.map((s) => s.sectionId));
    for (const cena of scenes.filter((s) => s.kind === "site")) {
      expect(idsReais.has(cena.sectionId!)).toBe(true);
    }
  });

  it("mantém as cenas de estúdio, que não dependem do site", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    expect(scenes.some((s) => s.kind === "studio" && s.component === "whatsapp")).toBe(true);
  });

  it("não usa a mesma seção em duas cenas", () => {
    const { scenes } = matchTemplate(templateById("institucional")!, secoes);
    const usados = scenes.filter((s) => s.kind === "site").map((s) => s.sectionId);
    expect(new Set(usados).size).toBe(usados.length);
  });
});
```

Ajuste `templates.test.ts`: os testes que somavam `defaultScenes` e checavam alvos de zoom por slot precisam mudar de alvo — agora conferem que todo template tem `wants` com palavras-chave não vazias e cenas de estúdio válidas. **Não apague as asserções, redirecione-as.**

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/web test src/features/video-studio/`
Expected: FAIL.

- [ ] **Step 3: Implementar**

O casamento é por substring: uma seção casa com um `want` se `sectionId` **ou** `label`, ambos em minúsculas e sem acento, contiverem alguma das `palavras`. Primeira seção não usada que casar, vence. A ordem das cenas segue a ordem do template, com as de estúdio nas posições que já tinham.

- [ ] **Step 4: Rodar, ver passar, mais type-check e lint**

Run: `pnpm --filter @millead/web test && pnpm --filter @millead/web type-check && pnpm --filter @millead/web lint`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/video-studio
git commit -m "feat: templates casam com as seções encontradas em vez de ditar a lista"
```

---

### Task 4: `buildBrief` e os prompts com a realidade

**Files:**
- Modify: `apps/web/src/features/video-studio/build-brief.ts`
- Modify: `apps/web/src/features/video-studio/build-prompt.ts`
- Modify: `apps/web/src/features/video-studio/build-capture-prompt.ts`
- Modify: `apps/web/src/features/video-studio/build-render-prompt.ts`
- Test: os quatro arquivos de teste correspondentes

**O que muda:**

- `buildBrief` monta a cena de site a partir do `FormScene` novo (`sectionId`, `label`, `screenshot`, `sourceNodeId`, `zoomTargets` com caixa) e exige `snapshotIds` do Snapshot carregado.
- `buildPrompt` (narração): a lista de cenas passa a usar o `label` real da seção em vez do rótulo de catálogo.
- `buildCapturePrompt`: passa a listar **apenas o que falta** capturar — cenas de site marcadas cujo `screenshot` é `null`. Quando não falta nada, o texto vira "nada a gravar: a captura já cobre todas as cenas escolhidas".
- `buildRenderPrompt`: cita o arquivo real (`sections/raio-x.jpg`) e a **caixa em pixel** de cada alvo (`amplia: Botão "Gerar meu diagnóstico" em {x,y,w,h}`).

- [ ] **Step 1: Atualizar os testes existentes para o contrato novo**

Os quatro arquivos de teste usam `slot` e `zoomTargets: string[]`. Migre-os para o formato novo, mantendo as asserções de comportamento. Acrescente:

```ts
// build-capture-prompt.test.ts
  it("diz que não há nada a gravar quando toda cena marcada já tem miniatura", () => {
    const prompt = buildCapturePrompt(briefComTodasAsMiniaturas);
    expect(prompt).toMatch(/nada a gravar/i);
  });

  it("lista só as cenas sem miniatura", () => {
    const prompt = buildCapturePrompt(briefComUmaSemMiniatura);
    expect(prompt).toContain("raio-x");
    expect(prompt).not.toContain("top");
  });
```

```ts
// build-render-prompt.test.ts
  it("cita o arquivo real da seção", () => {
    expect(buildRenderPrompt(brief)).toContain("sections/raio-x.jpg");
  });

  it("cita a caixa em pixel do alvo de zoom", () => {
    expect(buildRenderPrompt(brief)).toMatch(/\{ *x: *\d+/);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/web test src/features/video-studio/`

- [ ] **Step 3: Implementar as quatro mudanças**

- [ ] **Step 4: Rodar tudo**

Run: `pnpm --filter @millead/web test && pnpm --filter @millead/web type-check && pnpm --filter @millead/web lint`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/video-studio
git commit -m "feat: prompts citam seção real, arquivo e caixa de zoom"
```

---

### Task 5: A tela recebe a captura

**Files:**
- Create: `apps/web/src/features/video-studio/components/snapshot-input.tsx`
- Modify: `apps/web/src/features/video-studio/components/scene-list.tsx`
- Modify: `apps/web/src/app/(app)/videos/page.tsx`

**Sem teste automatizado** — convenção do repo (`vitest.config.ts` cobre só função pura, sem jsdom). Verificação é `next build` mais conferência manual.

**O que fazer:**

1. `snapshot-input.tsx`: um `<input type="file" webkitdirectory>` ("Escolher a pasta da captura") e um `<input type="file" accept=".json">` ("ou só o snapshot.json"). Lê os arquivos com `FileReader`/`file.text()`, valida com `SnapshotSchema.safeParse`, e devolve `{ snapshot, thumbs: Map<string, string> }` — o mapa liga `sections/x.jpg` a uma `blob:` URL criada com `URL.createObjectURL`. Revogue as URLs anteriores ao trocar de captura.
   - No TypeScript, `webkitdirectory` exige `// @ts-expect-error` ou uma prop `{...{ webkitdirectory: "" }}` — resolva do jeito que o lint aceitar e comente por quê.
   - JSON inválido mostra a mensagem do zod, não "erro".
2. `scene-list.tsx`: cada cena de site mostra a miniatura (a `blob:` URL do mapa) à esquerda, o `label` real, e os chips dos `zoomTargets` reais. Cena de estúdio segue como está, sem miniatura.
3. `page.tsx`:
   - Estado do snapshot e dos thumbs.
   - Sem snapshot: a lista mostra só cenas de estúdio, com um aviso — *"Cena de site exige uma captura. Rode `pnpm capture <url>` e escolha a pasta acima."*
   - Com snapshot: preenche `url` e nome da empresa a partir de `snapshot.url` e `snapshot.page.title` (só se estiverem vazios), e monta a lista com `sectionsFromSnapshot` + `zoomCandidatesFor`.
   - O seletor de template vira o botão **"Aplicar sugestão do template"**, que chama `matchTemplate` e mostra os `naoEncontrados` num aviso âmbar.

- [ ] **Step 1: Implementar os três arquivos**
- [ ] **Step 2: `next build`**

Run: `pnpm --filter @millead/web type-check && pnpm --filter @millead/web lint && pnpm --filter @millead/web build`

- [ ] **Step 3: Conferir na tela**

Run: `pnpm --filter @millead/web dev`, e em `/videos`:
1. Sem captura: só cenas de estúdio, com o aviso.
2. Escolher a pasta `apps/runner/captures/<a mais recente>`: aparecem **13 seções com miniatura**.
3. A seção `raio-x` está lá e pode ser marcada.
4. Os chips da `top` mostram o `h1` real e os botões "Falar no WhatsApp" e "Ver projetos".
5. "Aplicar sugestão do template" marca o que casou e avisa o que faltou.

Descreva no relatório o que você viu em cada item.

- [ ] **Step 4: Commit**

```bash
git add apps/web
git commit -m "feat: tela recebe a captura e lista as seções reais do site"
```

---

### Task 6: Aceite com o milweb

**Files:**
- Create: `docs/superpowers/plans/2026-07-29-video-studio-inspector-resultado.md`

- [ ] **Step 1: Rodar a captura fresca**

Run: `pnpm capture https://milweb.com.br`

- [ ] **Step 2: Carregar na tela e montar um vídeo que era impossível antes**

Monte uma timeline que inclua a `raio-x` — a seção que o catálogo antigo não tinha. Baixe o `videobrief.json` e copie o prompt de montagem.

- [ ] **Step 3: Conferir os quatro critérios da spec**

1. 13 seções listadas, com miniatura.
2. `raio-x` incluível.
3. Chips da `top` com o `h1` real e os dois botões.
4. Prompt de montagem citando `sections/raio-x.jpg` e a caixa em pixel.

- [ ] **Step 4: Registrar**

Escreva o resultado com o que funcionou, o que não funcionou, e o print do trecho do prompt de montagem que mostra a caixa.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers
git commit -m "docs: resultado do Inspector com o milweb"
```

---

## Notas de execução

**Ordem obrigatória:** 1 → 2 → 3 → 4 → 5 → 6. A Task 4 depende do contrato (1) e das funções (2, 3); a tela (5) depende de tudo.

**O que este plano NÃO faz:** rodar o crawler pela tela (exigiria API e Chromium no servidor), salvar o Snapshot no banco, detectar mudança do site entre capturas, editar caixa de zoom à mão, e multi-página.
