# Video Studio — Prompt Mestre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um configurador client-side em `/videos` que produz o prompt de narração pronto pra colar no Claude e o `videobrief.json` com a timeline decidida.

**Architecture:** Contrato `VideoBrief` em `packages/video-contracts`; catálogo de cenas, 5 templates e duas funções puras (`buildBrief`, `buildPrompt`) em `apps/web/src/features/video-studio/`; uma página cliente em `/videos` que só junta formulário e saída. Zero rota de API, zero migração, zero variável de ambiente.

**Tech Stack:** TypeScript 5.7, zod 3.24, Next 15 (App Router, client component), Tailwind + shadcn/ui, `@dnd-kit/sortable`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-29-video-studio-prompt-mestre-design.md`

## Global Constraints

- **zod `^3.24.1`** — há `overrides` na raiz do monorepo; zod 4 é proibido.
- `packages/video-contracts` é ESM/NodeNext: imports relativos terminam em `.js` (ex.: `./brief.js`) mesmo apontando para `.ts`. **No `apps/web` isso não vale** — lá o alias é `@/` e os imports são sem extensão, como no resto do web.
- Testes colocados junto do código como `src/**/*.test.ts`, Vitest com `environment: "node"`. O web já tem `vitest.config.ts` com alias `@` → `./src`.
- **Só funções puras têm teste.** Nada de jsdom nem teste de componente React — o `vitest.config.ts` do web diz isso explicitamente e não vamos mudar.
- Mensagens de erro e textos de tela **em português**.
- Determinismo: proibido `Date.now()` e `Math.random()` dentro das funções puras. O `createdAt` entra como parâmetro de `buildBrief`; só a página (borda) pode chamar `new Date()`.
- **Nenhuma dependência nova.** Não existe `radio-group` no `components/ui/` — para o modo de narração use o `Select` que já existe. Componentes disponíveis: avatar, badge, button, card, checkbox, command, dialog, dropdown-menu, input, label, pagination, popover, progress, scroll-area, select, separator, sheet, skeleton, sonner, switch, table, tabs, textarea, tooltip.
- Não criar rota de API, não mexer em Prisma, não adicionar env var.
- Branch de trabalho: `feat/video-studio-contratos` (a mesma das fatias anteriores).
- Commits em português, prefixo `feat:` / `test:` / `docs:` / `chore:`.

---

### Task 1: Contrato `VideoBrief`

**Files:**
- Create: `packages/video-contracts/src/brief.ts`
- Modify: `packages/video-contracts/src/index.ts`
- Test: `packages/video-contracts/src/brief.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `VideoBriefSchema`, `BriefSceneSchema`, `SITE_SLOTS` (tupla de slots), e os tipos `VideoBrief`, `BriefScene`, `SiteSlot`, `StudioComponent`. Tasks 2-6 importam de `@millead/video-contracts`.

- [ ] **Step 1: Escrever o teste que falha**

`packages/video-contracts/src/brief.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VideoBriefSchema } from "./brief.js";

function validBrief() {
  return {
    version: 1 as const,
    id: "kavita-drones-lancamento",
    createdAt: "2026-07-29T14:32:00.000Z",
    business: { name: "Kavita Drones", url: "https://kavita.com.br", segment: null },
    template: { id: "lancamento", name: "Lançamento de Site" },
    format: "9:16" as const,
    fps: 30,
    // As cenas abaixo somam 3+6+8 = 17s, e os orçamentos 8+15+20 = 43 palavras.
    // O superRefine exige que estes dois campos batam com as cenas.
    totalDurationSec: 17,
    wordBudget: 43,
    scenes: [
      { id: "sc1", kind: "studio" as const, component: "notebook" as const, durationSec: 3, zoomTargets: [] },
      {
        id: "sc2",
        kind: "studio" as const,
        component: "google" as const,
        durationSec: 6,
        zoomTargets: ["barra", "resultado"],
        query: "Kavita Drones",
        resultUrl: "https://kavita.com.br",
      },
      {
        id: "sc3",
        kind: "site" as const,
        slot: "hero" as const,
        durationSec: 8,
        zoomTargets: ["titulo", "botao"],
      },
    ],
    narration: { mode: "auto" as const, text: null, customInstructions: null },
  };
}

describe("VideoBriefSchema", () => {
  it("aceita um brief completo", () => {
    expect(() => VideoBriefSchema.parse(validBrief())).not.toThrow();
  });

  it("recusa version diferente de 1", () => {
    expect(() => VideoBriefSchema.parse({ ...validBrief(), version: 2 })).toThrow();
  });

  it("recusa cena google sem query", () => {
    const brief = validBrief();
    delete (brief.scenes[1] as Record<string, unknown>).query;
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });

  it("recusa slot de site desconhecido", () => {
    const brief = validBrief();
    (brief.scenes[2] as Record<string, unknown>).slot = "newsletter";
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });

  it("recusa URL do negócio que não é URL", () => {
    const brief = validBrief();
    brief.business.url = "kavita";
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/url/i);
  });

  it("recusa id de cena duplicado", () => {
    const brief = validBrief();
    brief.scenes[2]!.id = "sc1";
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/duplicad/i);
  });

  it("recusa totalDurationSec que não bate com a soma das cenas", () => {
    const brief = validBrief();
    brief.totalDurationSec = 99;
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/soma/i);
  });

  it("exige texto quando o modo de narração é manual", () => {
    // Objeto novo em vez de mutação: `validBrief()` infere mode como "auto"
    // literal, e atribuir "manual" nele não compila.
    const brief = {
      ...validBrief(),
      narration: { mode: "manual", text: null, customInstructions: null },
    };
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/manual/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/video-contracts test src/brief.test.ts`
Expected: FAIL — `Cannot find module './brief.js'`.

- [ ] **Step 3: Implementar o schema**

`packages/video-contracts/src/brief.ts`:

```ts
import { z } from "zod";

/**
 * Intenção de vídeo, decidida pelo humano no formulário. NÃO é um VideoProject:
 * aqui a cena de site aponta para um SLOT semântico ("hero"), não para um nó de
 * um Snapshot -- o Brief é produzido antes de o site ter sido capturado. Quando
 * o crawler existir, um compilador junta Brief + Snapshot -> VideoProject.
 */

export const SITE_SLOTS = [
  "hero",
  "sobre",
  "servicos",
  "produtos",
  "depoimentos",
  "faq",
  "formulario",
  "rodape",
] as const;

const SiteSlotSchema = z.enum(SITE_SLOTS);

const SiteSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("site"),
  slot: SiteSlotSchema,
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  note: z.string().optional(),
});

const NotebookSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("notebook"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
});

const GoogleSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("google"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  query: z.string().min(1),
  resultUrl: z.string().url(),
});

const WhatsappSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("whatsapp"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  company: z.string().min(1),
  message: z.string().min(1),
});

const LogoSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("logo"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  tagline: z.string().nullable(),
});

/**
 * Union por `component` dentro do ramo studio: props EXPLÍCITAS por componente,
 * nunca uma sacola `z.record(z.unknown())` -- é o que faz o zod recusar uma cena
 * google sem `query`.
 */
const StudioSceneSchema = z.discriminatedUnion("component", [
  NotebookSceneSchema,
  GoogleSceneSchema,
  WhatsappSceneSchema,
  LogoSceneSchema,
]);

export const BriefSceneSchema = z.union([SiteSceneSchema, StudioSceneSchema]);

export const VideoBriefSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    business: z.object({
      name: z.string().min(1),
      url: z.string().url("informe uma URL válida, começando com http:// ou https://"),
      segment: z.string().nullable(),
    }),
    template: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    format: z.enum(["9:16", "16:9", "1:1"]),
    fps: z.number().int().positive(),
    totalDurationSec: z.number().positive(),
    wordBudget: z.number().int().nonnegative(),
    scenes: z.array(BriefSceneSchema).min(1),
    narration: z.object({
      mode: z.enum(["auto", "manual", "custom"]),
      text: z.string().nullable(),
      customInstructions: z.string().nullable(),
    }),
  })
  .superRefine((brief, ctx) => {
    const seen = new Set<string>();
    for (const scene of brief.scenes) {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de cena duplicado: ${scene.id}`,
          path: ["scenes"],
        });
      }
      seen.add(scene.id);
    }

    const soma = brief.scenes.reduce((total, scene) => total + scene.durationSec, 0);
    if (soma !== brief.totalDurationSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `totalDurationSec (${brief.totalDurationSec}) não bate com a soma das cenas (${soma})`,
        path: ["totalDurationSec"],
      });
    }

    if (brief.narration.mode === "manual" && !brief.narration.text?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "narração manual exige o texto escrito",
        path: ["narration", "text"],
      });
    }

    if (brief.narration.mode === "custom" && !brief.narration.customInstructions?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "modo de instruções próprias exige as instruções",
        path: ["narration", "customInstructions"],
      });
    }
  });

export type SiteSlot = (typeof SITE_SLOTS)[number];
export type BriefScene = z.infer<typeof BriefSceneSchema>;
export type StudioComponent = Extract<BriefScene, { kind: "studio" }>["component"];
export type VideoBrief = z.infer<typeof VideoBriefSchema>;
```

- [ ] **Step 4: Reexportar no index**

`packages/video-contracts/src/index.ts` passa a ser:

```ts
export * from "./annotation.js";
export * from "./brief.js";
export * from "./manifest.js";
export * from "./project.js";
export * from "./snapshot.js";
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @millead/video-contracts test && pnpm --filter @millead/video-contracts type-check && pnpm --filter @millead/video-contracts lint`
Expected: PASS — 19 testes (11 anteriores + 8 novos), sem erro de tipo nem lint.

- [ ] **Step 6: Commit**

```bash
git add packages/video-contracts
git commit -m "feat: contrato VideoBrief"
```

---

### Task 2: Catálogo de cenas e os 5 templates

**Files:**
- Create: `apps/web/src/features/video-studio/types.ts`
- Create: `apps/web/src/features/video-studio/scenes.ts`
- Create: `apps/web/src/features/video-studio/templates.ts`
- Test: `apps/web/src/features/video-studio/templates.test.ts`

**Interfaces:**
- Consumes: `SiteSlot`, `StudioComponent` de `@millead/video-contracts` (Task 1).
- Produces:
  - `FormScene`, `VideoStudioForm`, `ZoomTarget`, `TemplateId`, `PromptTemplate` (tipos)
  - `SITE_SLOT_INFO`, `STUDIO_COMPONENT_INFO` — catálogos com `label` e `zoomTargets`
  - `zoomTargetsFor(scene: FormScene): ZoomTarget[]`
  - `sceneLabel(scene: FormScene): string`
  - `TEMPLATES: PromptTemplate[]` e `templateById(id: string): PromptTemplate | undefined`

**Atenção:** os `body` dos templates usam `{{blocoNarracao}}` como variável — o texto que muda conforme o modo é montado em código na Task 4, não fica no template.

- [ ] **Step 1: Criar os tipos**

`apps/web/src/features/video-studio/types.ts`:

```ts
import type { SiteSlot, StudioComponent } from "@millead/video-contracts";

export interface ZoomTarget {
  id: string;
  label: string;
}

/** Cena como ela vive no formulário: editável, podendo estar desmarcada. */
export interface FormScene {
  id: string;
  kind: "site" | "studio";
  /** Preenchido quando kind === "site". */
  slot?: SiteSlot;
  /** Preenchido quando kind === "studio". */
  component?: StudioComponent;
  enabled: boolean;
  durationSec: number;
  zoomTargets: string[];
}

export type VideoFormat = "9:16" | "16:9" | "1:1";
export type NarrationMode = "auto" | "manual" | "custom";
export type TotalDuration = 15 | 30 | 45 | 60;

export interface VideoStudioForm {
  businessName: string;
  url: string;
  segment: string;
  templateId: string;
  totalDurationSec: TotalDuration;
  format: VideoFormat;
  scenes: FormScene[];
  narrationMode: NarrationMode;
  narrationText: string;
  customInstructions: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  defaultScenes: FormScene[];
  body: string;
}
```

- [ ] **Step 2: Criar o catálogo de cenas**

`apps/web/src/features/video-studio/scenes.ts`:

```ts
import type { SiteSlot, StudioComponent } from "@millead/video-contracts";
import type { FormScene, ZoomTarget } from "./types";

interface SceneInfo {
  label: string;
  zoomTargets: ZoomTarget[];
}

/**
 * Alvos de zoom são nomes de intenção, não seletores: o crawler ainda não
 * existe. Quando existir, o compilador casa cada nome com um elemento real.
 */
export const SITE_SLOT_INFO: Record<SiteSlot, SceneInfo> = {
  hero: {
    label: "Hero",
    zoomTargets: [
      { id: "titulo", label: "Título" },
      { id: "botao", label: "Botão principal" },
      { id: "imagem", label: "Imagem de fundo" },
    ],
  },
  sobre: {
    label: "Sobre",
    zoomTargets: [
      { id: "texto", label: "Texto" },
      { id: "imagem", label: "Imagem" },
    ],
  },
  servicos: { label: "Serviços", zoomTargets: [{ id: "cards", label: "Cards" }] },
  produtos: {
    label: "Produtos",
    zoomTargets: [
      { id: "cards", label: "Cards" },
      { id: "preco", label: "Preço" },
    ],
  },
  depoimentos: { label: "Depoimentos", zoomTargets: [{ id: "citacao", label: "Citação" }] },
  faq: { label: "FAQ", zoomTargets: [{ id: "pergunta", label: "Pergunta" }] },
  formulario: {
    label: "Formulário",
    zoomTargets: [
      { id: "campos", label: "Campos" },
      { id: "enviar", label: "Botão Enviar" },
    ],
  },
  rodape: { label: "Rodapé", zoomTargets: [{ id: "contato", label: "Contato" }] },
};

export const STUDIO_COMPONENT_INFO: Record<StudioComponent, SceneInfo> = {
  notebook: { label: "Notebook abrindo", zoomTargets: [] },
  google: {
    label: "Busca no Google",
    zoomTargets: [
      { id: "barra", label: "Barra de pesquisa" },
      { id: "resultado", label: "Primeiro resultado" },
      { id: "url", label: "Endereço do site" },
    ],
  },
  whatsapp: {
    label: "Prova no WhatsApp",
    zoomTargets: [
      { id: "conversa", label: "Conversa" },
      { id: "mensagem", label: "Mensagem recebida" },
    ],
  },
  logo: { label: "Logo e CTA", zoomTargets: [] },
};

export function zoomTargetsFor(scene: FormScene): ZoomTarget[] {
  if (scene.kind === "site" && scene.slot) return SITE_SLOT_INFO[scene.slot].zoomTargets;
  if (scene.kind === "studio" && scene.component)
    return STUDIO_COMPONENT_INFO[scene.component].zoomTargets;
  return [];
}

export function sceneLabel(scene: FormScene): string {
  if (scene.kind === "site" && scene.slot) return SITE_SLOT_INFO[scene.slot].label;
  if (scene.kind === "studio" && scene.component)
    return STUDIO_COMPONENT_INFO[scene.component].label;
  return scene.id;
}
```

- [ ] **Step 3: Escrever o teste dos templates (falha)**

`apps/web/src/features/video-studio/templates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { zoomTargetsFor } from "./scenes";
import { TEMPLATES, templateById } from "./templates";

const TOTAIS: Record<string, number> = {
  institucional: 30,
  lancamento: 30,
  portfolio: 45,
  loja: 45,
  captacao: 30,
};

describe("TEMPLATES", () => {
  it("tem os cinco templates esperados", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(
      ["captacao", "institucional", "lancamento", "loja", "portfolio"].sort(),
    );
  });

  it.each(TEMPLATES)("$id soma exatamente o total declarado", (template) => {
    const soma = template.defaultScenes.reduce((total, s) => total + s.durationSec, 0);
    expect(soma).toBe(TOTAIS[template.id]);
  });

  it.each(TEMPLATES)("$id só usa alvos de zoom que existem na cena", (template) => {
    for (const scene of template.defaultScenes) {
      const validos = zoomTargetsFor(scene).map((t) => t.id);
      for (const alvo of scene.zoomTargets) {
        expect(validos).toContain(alvo);
      }
    }
  });

  it.each(TEMPLATES)("$id tem ids de cena únicos", (template) => {
    const ids = template.defaultScenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TEMPLATES)("$id declara todas as variáveis que o corpo usa", (template) => {
    const usadas = [...template.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const conhecidas = [
      "empresa",
      "url",
      "duracao",
      "formato",
      "orcamentoPalavras",
      "cenas",
      "blocoNarracao",
    ];
    for (const variavel of usadas) {
      expect(conhecidas).toContain(variavel);
    }
  });

  it("templateById acha e devolve undefined pro que não existe", () => {
    expect(templateById("lancamento")?.name).toBe("Lançamento de Site");
    expect(templateById("nao-existe")).toBeUndefined();
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @millead/web test src/features/video-studio/templates.test.ts`
Expected: FAIL — `Cannot find module './templates'`.

- [ ] **Step 5: Implementar os templates**

`apps/web/src/features/video-studio/templates.ts`:

```ts
import type { FormScene, PromptTemplate } from "./types";

function site(id: string, slot: FormScene["slot"], durationSec: number, zoomTargets: string[] = []): FormScene {
  return { id, kind: "site", slot, enabled: true, durationSec, zoomTargets };
}

function studio(
  id: string,
  component: FormScene["component"],
  durationSec: number,
  zoomTargets: string[] = [],
): FormScene {
  return { id, kind: "studio", component, enabled: true, durationSec, zoomTargets };
}

/**
 * Corpo comum dos cinco templates. O que muda entre eles é o parágrafo de
 * abertura e a sequência padrão de cenas -- as regras da narração são as
 * mesmas, e nenhuma instrução do usuário pode removê-las (ver buildPrompt).
 */
function body(abertura: string): string {
  return [
    abertura,
    "",
    "Empresa: {{empresa}}",
    "Site: {{url}}",
    "Formato: {{formato}} — {{duracao}} segundos",
    "",
    "O vídeo é uma GRAVAÇÃO DE TELA já definida. A timeline abaixo está fechada;",
    "você não a altera. Cada cena traz seu orçamento de palavras.",
    "",
    "{{cenas}}",
    "",
    "ANTES de narrar, se a ordem ou as durações prejudicarem o vídeo, diga em até",
    "três frases. Se estiver bom, não invente crítica.",
    "",
    "{{blocoNarracao}}",
    "",
    "Regras da narração:",
    "- Português do Brasil, frases curtas, linguagem comercial, sem jargão.",
    "- Respeite o orçamento de palavras de cada cena. Total: {{orcamentoPalavras}} palavras.",
    "- Cena pode ficar em silêncio se o texto não acrescentar nada.",
    "- Nunca invente fato do negócio: prêmio, número de clientes, telefone ou endereço.",
    "- Termine convidando a acessar o site.",
    "",
    "Responda em JSON:",
    '{ "criticas": [], "narracao": [ { "sceneId": "...", "texto": "...", "legenda": "..." } ] }',
  ].join("\n");
}

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "institucional",
    name: "Institucional",
    description: "Apresenta a empresa, o que ela faz e como falar com ela.",
    defaultScenes: [
      studio("sc1", "notebook", 3),
      studio("sc2", "google", 5, ["barra", "resultado"]),
      site("sc3", "hero", 6, ["titulo"]),
      site("sc4", "sobre", 5, ["texto"]),
      site("sc5", "servicos", 6, ["cards"]),
      site("sc6", "formulario", 3, ["campos"]),
      studio("sc7", "whatsapp", 2, ["mensagem"]),
    ],
    body: body("Você escreve narração para vídeos institucionais curtos de divulgação de sites."),
  },
  {
    id: "lancamento",
    name: "Lançamento de Site",
    description: "Anuncia que o site novo está no ar, começando pela busca no Google.",
    defaultScenes: [
      studio("sc1", "notebook", 3),
      studio("sc2", "google", 6, ["barra", "resultado", "url"]),
      site("sc3", "hero", 8, ["titulo", "botao"]),
      site("sc4", "produtos", 6, ["cards"]),
      studio("sc5", "whatsapp", 4, ["mensagem"]),
      studio("sc6", "logo", 3),
    ],
    body: body("Você escreve narração para vídeos que anunciam o lançamento do site novo de uma empresa."),
  },
  {
    id: "portfolio",
    name: "Portfólio",
    description: "Percorre trabalhos e diferenciais, terminando em contato.",
    defaultScenes: [
      site("sc1", "hero", 6, ["titulo"]),
      site("sc2", "servicos", 8, ["cards"]),
      site("sc3", "produtos", 15, ["cards"]),
      site("sc4", "depoimentos", 8, ["citacao"]),
      site("sc5", "formulario", 5, ["enviar"]),
      studio("sc6", "logo", 3),
    ],
    body: body("Você escreve narração para vídeos de portfólio, que mostram trabalhos entregues."),
  },
  {
    id: "loja",
    name: "Loja Virtual",
    description: "Destaca categorias e produtos, terminando no atendimento.",
    defaultScenes: [
      studio("sc1", "google", 5, ["barra", "resultado"]),
      site("sc2", "hero", 6, ["titulo"]),
      site("sc3", "produtos", 18, ["cards", "preco"]),
      site("sc4", "formulario", 6, ["campos"]),
      studio("sc5", "whatsapp", 6, ["conversa"]),
      studio("sc6", "logo", 4),
    ],
    body: body("Você escreve narração para vídeos de loja virtual, focados em produto e compra."),
  },
  {
    id: "captacao",
    name: "Captação de Leads",
    description: "Foca no formulário e na chegada da mensagem no WhatsApp.",
    defaultScenes: [
      site("sc1", "hero", 6, ["titulo", "botao"]),
      site("sc2", "servicos", 6, ["cards"]),
      site("sc3", "formulario", 10, ["campos", "enviar"]),
      studio("sc4", "whatsapp", 5, ["mensagem"]),
      studio("sc5", "logo", 3),
    ],
    body: body("Você escreve narração para vídeos de captação de leads, que levam ao formulário."),
  },
];

export function templateById(id: string): PromptTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @millead/web test src/features/video-studio/templates.test.ts`
Expected: PASS.

> Se `só usa alvos de zoom que existem na cena` falhar, o erro está na tabela acima: algum `zoomTargets` cita um id que o `scenes.ts` não declara para aquele slot. Corrija a tabela, não o teste — é exatamente para isso que ele existe.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/video-studio
git commit -m "feat: catálogo de cenas e os cinco templates do Video Studio"
```

---

### Task 3: `buildBrief` e a escala de durações

**Files:**
- Create: `apps/web/src/features/video-studio/build-brief.ts`
- Test: `apps/web/src/features/video-studio/build-brief.test.ts`

**Interfaces:**
- Consumes: `FormScene`, `VideoStudioForm`, `PromptTemplate` (Task 2); `zoomTargetsFor` (Task 2); `VideoBriefSchema`, `VideoBrief` (Task 1).
- Produces:
  - `wordBudgetFor(durationSec: number): number` — `Math.round(durationSec * 2.5)`
  - `scaleDurations(scenes: FormScene[], targetTotalSec: number): FormScene[]`
  - `totalDuration(scenes: FormScene[]): number` — soma só das habilitadas
  - `totalWordBudget(scenes: FormScene[]): number` — soma dos orçamentos por cena
  - `briefId(businessName: string, templateId: string): string`
  - `buildBrief(form: VideoStudioForm, template: PromptTemplate, createdAt: string): VideoBrief`

**Regras que os testes travam:** escalar produz soma **exata** (a sobra do arredondamento vai para a cena mais longa); `wordBudget` do brief é a **soma dos por-cena**, não `round(total * 2,5)`; cena desmarcada não entra no brief nem no total.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/src/features/video-studio/build-brief.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  briefId,
  buildBrief,
  scaleDurations,
  totalDuration,
  totalWordBudget,
  wordBudgetFor,
} from "./build-brief";
import { TEMPLATES, templateById } from "./templates";
import type { VideoStudioForm } from "./types";

const PRESETS = [15, 30, 45, 60] as const;

function form(overrides: Partial<VideoStudioForm> = {}): VideoStudioForm {
  const template = templateById("lancamento")!;
  return {
    businessName: "Kavita Drones",
    url: "https://kavita.com.br",
    segment: "",
    templateId: template.id,
    totalDurationSec: 30,
    format: "9:16",
    scenes: template.defaultScenes.map((s) => ({ ...s })),
    narrationMode: "auto",
    narrationText: "",
    customInstructions: "",
    ...overrides,
  };
}

describe("wordBudgetFor", () => {
  it("usa 2,5 palavras por segundo", () => {
    expect(wordBudgetFor(8)).toBe(20);
    expect(wordBudgetFor(3)).toBe(8);
  });
});

describe("scaleDurations", () => {
  for (const template of TEMPLATES) {
    for (const alvo of PRESETS) {
      it(`${template.id} escalado para ${alvo}s soma exatamente ${alvo}`, () => {
        const escaladas = scaleDurations(template.defaultScenes, alvo);
        expect(totalDuration(escaladas)).toBe(alvo);
      });
    }
  }

  it("nunca produz cena com menos de 1 segundo", () => {
    const escaladas = scaleDurations(templateById("loja")!.defaultScenes, 15);
    expect(escaladas.every((s) => s.durationSec >= 1)).toBe(true);
  });

  it("ignora cenas desmarcadas ao escalar", () => {
    const scenes = templateById("captacao")!.defaultScenes.map((s, i) =>
      i === 0 ? { ...s, enabled: false } : { ...s },
    );
    const escaladas = scaleDurations(scenes, 30);
    expect(totalDuration(escaladas)).toBe(30);
    expect(escaladas[0]!.durationSec).toBe(scenes[0]!.durationSec);
  });
});

describe("totalWordBudget", () => {
  it("é a soma dos orçamentos por cena, não o orçamento do total", () => {
    const scenes = [
      { ...templateById("lancamento")!.defaultScenes[0]!, durationSec: 3 },
      { ...templateById("lancamento")!.defaultScenes[1]!, durationSec: 3 },
    ];
    // round(3*2.5) = 8 duas vezes = 16; round(6*2.5) seria 15.
    expect(totalWordBudget(scenes)).toBe(16);
  });
});

describe("briefId", () => {
  it("faz slug do negócio com o template", () => {
    expect(briefId("Kavita Drones", "lancamento")).toBe("kavita-drones-lancamento");
  });

  it("tira acento e pontuação", () => {
    expect(briefId("Ação & Cia.", "loja")).toBe("acao-cia-loja");
  });

  it("cai num padrão quando o nome está vazio", () => {
    expect(briefId("   ", "loja")).toBe("projeto-loja");
  });
});

describe("buildBrief", () => {
  const createdAt = "2026-07-29T14:32:00.000Z";

  it("produz um brief que valida no schema", () => {
    expect(() =>
      buildBrief(form(), templateById("lancamento")!, createdAt),
    ).not.toThrow();
  });

  it("deixa de fora as cenas desmarcadas", () => {
    const base = form();
    base.scenes[0]!.enabled = false;
    const brief = buildBrief(base, templateById("lancamento")!, createdAt);
    expect(brief.scenes).toHaveLength(base.scenes.length - 1);
    expect(brief.totalDurationSec).toBe(totalDuration(base.scenes));
  });

  it("preenche as props da cena do Google com os dados do negócio", () => {
    const brief = buildBrief(form(), templateById("lancamento")!, createdAt);
    const google = brief.scenes.find((s) => s.kind === "studio" && s.component === "google");
    expect(google).toMatchObject({ query: "Kavita Drones", resultUrl: "https://kavita.com.br" });
  });

  it("recusa URL inválida com mensagem em português", () => {
    expect(() =>
      buildBrief(form({ url: "kavita" }), templateById("lancamento")!, createdAt),
    ).toThrow(/URL válida/i);
  });

  it("recusa quando nenhuma cena está marcada", () => {
    const base = form();
    base.scenes = base.scenes.map((s) => ({ ...s, enabled: false }));
    expect(() => buildBrief(base, templateById("lancamento")!, createdAt)).toThrow(/nenhuma cena/i);
  });

  it("guarda o texto quando a narração é manual", () => {
    const brief = buildBrief(
      form({ narrationMode: "manual", narrationText: "Conheça a Kavita." }),
      templateById("lancamento")!,
      createdAt,
    );
    expect(brief.narration).toEqual({
      mode: "manual",
      text: "Conheça a Kavita.",
      customInstructions: null,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/web test src/features/video-studio/build-brief.test.ts`
Expected: FAIL — `Cannot find module './build-brief'`.

- [ ] **Step 3: Implementar**

`apps/web/src/features/video-studio/build-brief.ts`:

```ts
import { VideoBriefSchema, type BriefScene, type VideoBrief } from "@millead/video-contracts";
import type { FormScene, PromptTemplate, VideoStudioForm } from "./types";

/** PT-BR narrado em ritmo comercial: ~2,5 palavras por segundo. */
const PALAVRAS_POR_SEGUNDO = 2.5;

export function wordBudgetFor(durationSec: number): number {
  return Math.round(durationSec * PALAVRAS_POR_SEGUNDO);
}

export function totalDuration(scenes: FormScene[]): number {
  return scenes.filter((s) => s.enabled).reduce((total, s) => total + s.durationSec, 0);
}

export function totalWordBudget(scenes: FormScene[]): number {
  return scenes
    .filter((s) => s.enabled)
    .reduce((total, s) => total + wordBudgetFor(s.durationSec), 0);
}

/**
 * Escala proporcionalmente e devolve a sobra do arredondamento à cena mais
 * longa -- sem isso, 45s vira 44s ou 46s e ninguém entende por quê. Cenas
 * desmarcadas ficam intactas: elas não contam para o total.
 */
export function scaleDurations(scenes: FormScene[], targetTotalSec: number): FormScene[] {
  const atual = totalDuration(scenes);
  if (atual === 0) return scenes.map((s) => ({ ...s }));

  const escaladas = scenes.map((scene) =>
    scene.enabled
      ? { ...scene, durationSec: Math.max(1, Math.round((scene.durationSec / atual) * targetTotalSec)) }
      : { ...scene },
  );

  const sobra = targetTotalSec - totalDuration(escaladas);
  if (sobra !== 0) {
    let maiorIndex = -1;
    for (const [index, scene] of escaladas.entries()) {
      if (!scene.enabled) continue;
      if (maiorIndex === -1 || scene.durationSec > escaladas[maiorIndex]!.durationSec) {
        maiorIndex = index;
      }
    }
    if (maiorIndex !== -1) {
      const alvo = escaladas[maiorIndex]!;
      escaladas[maiorIndex] = { ...alvo, durationSec: Math.max(1, alvo.durationSec + sobra) };
    }
  }

  return escaladas;
}

export function briefId(businessName: string, templateId: string): string {
  const slug =
    businessName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto";
  return `${slug}-${templateId}`;
}

function toBriefScene(scene: FormScene, form: VideoStudioForm): BriefScene {
  const comum = {
    id: scene.id,
    durationSec: scene.durationSec,
    zoomTargets: scene.zoomTargets,
  };

  if (scene.kind === "site") {
    return { ...comum, kind: "site", slot: scene.slot! };
  }

  switch (scene.component) {
    case "google":
      return {
        ...comum,
        kind: "studio",
        component: "google",
        query: form.businessName.trim(),
        resultUrl: form.url.trim(),
      };
    case "whatsapp":
      return {
        ...comum,
        kind: "studio",
        component: "whatsapp",
        company: form.businessName.trim(),
        message: `Olá! Vim pelo site da ${form.businessName.trim()} e quero mais informações.`,
      };
    case "logo":
      return { ...comum, kind: "studio", component: "logo", tagline: null };
    default:
      return { ...comum, kind: "studio", component: "notebook" };
  }
}

export function buildBrief(
  form: VideoStudioForm,
  template: PromptTemplate,
  createdAt: string,
): VideoBrief {
  const ativas = form.scenes.filter((s) => s.enabled);
  if (ativas.length === 0) {
    throw new Error("marque ao menos uma cena para gerar o vídeo");
  }

  const brief = {
    version: 1 as const,
    id: briefId(form.businessName, template.id),
    createdAt,
    business: {
      name: form.businessName.trim(),
      url: form.url.trim(),
      segment: form.segment.trim() || null,
    },
    template: { id: template.id, name: template.name },
    format: form.format,
    fps: 30,
    totalDurationSec: totalDuration(form.scenes),
    wordBudget: totalWordBudget(form.scenes),
    scenes: ativas.map((scene) => toBriefScene(scene, form)),
    narration: {
      mode: form.narrationMode,
      text: form.narrationMode === "manual" ? form.narrationText.trim() : null,
      customInstructions:
        form.narrationMode === "custom" ? form.customInstructions.trim() : null,
    },
  };

  const parsed = VideoBriefSchema.safeParse(brief);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  return parsed.data;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/web test src/features/video-studio/build-brief.test.ts`
Expected: PASS — 20 casos de escala (5 templates × 4 presets) mais os demais.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/video-studio
git commit -m "feat: buildBrief com escala exata de durações"
```

---

### Task 4: `buildPrompt`

**Files:**
- Create: `apps/web/src/features/video-studio/build-prompt.ts`
- Test: `apps/web/src/features/video-studio/build-prompt.test.ts`

**Interfaces:**
- Consumes: `VideoBrief` (Task 1); `PromptTemplate` (Task 2); `sceneLabel`, `zoomTargetsFor`, `SITE_SLOT_INFO`, `STUDIO_COMPONENT_INFO` (Task 2); `wordBudgetFor` (Task 3).
- Produces:
  - `buildSceneList(brief: VideoBrief): string`
  - `buildPrompt(brief: VideoBrief, template: PromptTemplate): string`
  - `promptFileName(brief: VideoBrief): string`

**Regras que os testes travam:** nenhuma `{{variável}}` sobra (lança se sobrar); modo `manual` pede **ajuste** em vez de escrita; modo `custom` **acrescenta** instruções sem remover nenhuma regra fixa.

- [ ] **Step 1: Escrever o teste que falha**

`apps/web/src/features/video-studio/build-prompt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildBrief } from "./build-brief";
import { buildPrompt, buildSceneList, promptFileName } from "./build-prompt";
import { templateById } from "./templates";
import type { VideoStudioForm } from "./types";

const createdAt = "2026-07-29T14:32:00.000Z";
const template = templateById("lancamento")!;

function form(overrides: Partial<VideoStudioForm> = {}): VideoStudioForm {
  return {
    businessName: "Kavita Drones",
    url: "https://kavita.com.br",
    segment: "",
    templateId: template.id,
    totalDurationSec: 30,
    format: "9:16",
    scenes: template.defaultScenes.map((s) => ({ ...s })),
    narrationMode: "auto",
    narrationText: "",
    customInstructions: "",
    ...overrides,
  };
}

const briefAuto = buildBrief(form(), template, createdAt);

describe("buildSceneList", () => {
  const lista = buildSceneList(briefAuto);

  it("numera as cenas na ordem", () => {
    expect(lista.split("\n")[0]).toMatch(/^1\. /);
    expect(lista.split("\n")[1]).toMatch(/^2\. /);
  });

  it("mostra duração e orçamento de palavras de cada cena", () => {
    expect(lista).toContain("3s — 8 palavras");
  });

  it("mostra os alvos de zoom quando existem", () => {
    expect(lista).toMatch(/zoom: Barra de pesquisa, Primeiro resultado/);
  });

  it("não escreve 'zoom:' em cena sem alvo marcado", () => {
    const linhaNotebook = lista.split("\n")[0]!;
    expect(linhaNotebook).not.toContain("zoom:");
  });
});

describe("buildPrompt", () => {
  it("não deixa nenhuma variável por substituir", () => {
    expect(buildPrompt(briefAuto, template)).not.toContain("{{");
  });

  it("lança quando o template usa variável desconhecida", () => {
    const quebrado = { ...template, body: "Olá {{inexistente}}" };
    expect(() => buildPrompt(briefAuto, quebrado)).toThrow(/inexistente/);
  });

  it("injeta empresa, url, duração e orçamento", () => {
    const prompt = buildPrompt(briefAuto, template);
    expect(prompt).toContain("Kavita Drones");
    expect(prompt).toContain("https://kavita.com.br");
    expect(prompt).toContain("9:16 — 30 segundos");
    expect(prompt).toContain(`Total: ${briefAuto.wordBudget} palavras`);
  });

  it("no modo automático pede a narração do zero", () => {
    expect(buildPrompt(briefAuto, template)).toContain("Escreva a narração");
  });

  it("no modo manual pede ajuste e inclui o texto escrito", () => {
    const brief = buildBrief(
      form({ narrationMode: "manual", narrationText: "Conheça a Kavita." }),
      template,
      createdAt,
    );
    const prompt = buildPrompt(brief, template);
    expect(prompt).toContain("Conheça a Kavita.");
    expect(prompt).toMatch(/encaixe-a nos orçamentos/i);
    expect(prompt).not.toContain("Escreva a narração");
  });

  it("no modo custom acrescenta as instruções sem remover as regras fixas", () => {
    const brief = buildBrief(
      form({ narrationMode: "custom", customInstructions: "Use tom bem-humorado." }),
      template,
      createdAt,
    );
    const prompt = buildPrompt(brief, template);
    expect(prompt).toContain("Use tom bem-humorado.");
    expect(prompt).toContain("Nunca invente fato do negócio");
    expect(prompt).toContain("Respeite o orçamento de palavras");
  });
});

describe("promptFileName", () => {
  it("deriva do id do brief", () => {
    expect(promptFileName(briefAuto)).toBe("prompt-kavita-drones-lancamento.md");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/web test src/features/video-studio/build-prompt.test.ts`
Expected: FAIL — `Cannot find module './build-prompt'`.

- [ ] **Step 3: Implementar**

`apps/web/src/features/video-studio/build-prompt.ts`:

```ts
import type { BriefScene, VideoBrief } from "@millead/video-contracts";
import { wordBudgetFor } from "./build-brief";
import { SITE_SLOT_INFO, STUDIO_COMPONENT_INFO } from "./scenes";
import type { PromptTemplate } from "./types";

function infoFor(scene: BriefScene): { label: string; zoomTargets: { id: string; label: string }[] } {
  return scene.kind === "site"
    ? SITE_SLOT_INFO[scene.slot]
    : STUDIO_COMPONENT_INFO[scene.component];
}

function sceneTag(scene: BriefScene): string {
  return scene.kind === "site" ? scene.slot : scene.component;
}

export function buildSceneList(brief: VideoBrief): string {
  return brief.scenes
    .map((scene, index) => {
      const info = infoFor(scene);
      const alvos = scene.zoomTargets
        .map((id) => info.zoomTargets.find((t) => t.id === id)?.label ?? id)
        .join(", ");
      const partes = [
        `${index + 1}. [${sceneTag(scene)}] ${scene.durationSec}s — ${wordBudgetFor(scene.durationSec)} palavras — ${info.label}`,
      ];
      if (alvos) partes.push(`zoom: ${alvos}`);
      return partes.join("; ");
    })
    .join("\n");
}

/**
 * O bloco que muda conforme o modo. As REGRAS fixas do template (idioma,
 * orçamento, não inventar fato do negócio) ficam fora daqui de propósito:
 * instrução do usuário acrescenta, nunca desliga uma trava.
 */
function narrationBlock(brief: VideoBrief): string {
  switch (brief.narration.mode) {
    case "manual":
      return [
        "Abaixo está a narração já escrita. Encaixe-a nos orçamentos de palavras de",
        "cada cena, preservando o sentido e o tom. Não reescreva o que já cabe.",
        "",
        brief.narration.text ?? "",
      ].join("\n");
    case "custom":
      return [
        "Escreva a narração seguindo também estas instruções do autor:",
        "",
        brief.narration.customInstructions ?? "",
      ].join("\n");
    default:
      return "Escreva a narração de cada cena.";
  }
}

export function buildPrompt(brief: VideoBrief, template: PromptTemplate): string {
  const valores: Record<string, string> = {
    empresa: brief.business.name,
    url: brief.business.url,
    duracao: String(brief.totalDurationSec),
    formato: brief.format,
    orcamentoPalavras: String(brief.wordBudget),
    cenas: buildSceneList(brief),
    blocoNarracao: narrationBlock(brief),
  };

  const prompt = template.body.replace(/\{\{(\w+)\}\}/g, (_match, chave: string) => {
    const valor = valores[chave];
    if (valor === undefined) {
      throw new Error(`variável desconhecida no template "${template.id}": {{${chave}}}`);
    }
    return valor;
  });

  if (prompt.includes("{{")) {
    throw new Error(`sobrou variável não substituída no template "${template.id}"`);
  }
  return prompt;
}

export function promptFileName(brief: VideoBrief): string {
  return `prompt-${brief.id}.md`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/web test src/features/video-studio/`
Expected: PASS — templates, build-brief e build-prompt.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/video-studio
git commit -m "feat: buildPrompt com bloco de narração por modo"
```

---

### Task 5: A tela `/videos` gerando o prompt

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/components/shell/nav-items.ts`
- Create: `apps/web/src/app/(app)/videos/page.tsx`
- Create: `apps/web/src/features/video-studio/components/scene-list.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 2-4 (`TEMPLATES`, `templateById`, `buildBrief`, `buildPrompt`, `scaleDurations`, `totalDuration`, `totalWordBudget`, `sceneLabel`, `zoomTargetsFor`).
- Produces: a rota `/videos`. A Task 6 acrescenta arrasto, chips de zoom, narração e download nesta mesma tela.

**Sem teste automatizado nesta task** — o `vitest.config.ts` do web cobre só funções puras, sem jsdom, e não vamos mudar isso. A verificação é `next build` mais o passo manual do Step 7.

- [ ] **Step 1: Declarar a dependência do workspace**

Em `apps/web/package.json`, dentro de `"dependencies"`, em ordem alfabética (antes de `@radix-ui/react-avatar`):

```json
    "@millead/video-contracts": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 2: Transpilar o pacote no Next**

Em `apps/web/next.config.ts`, dentro do objeto `nextConfig`, acrescente a chave abaixo (o objeto hoje tem `reactStrictMode` e `headers`):

```ts
  // Primeiro pacote de runtime do workspace consumido pelo web. O
  // @millead/video-contracts publica .ts cru (main: ./src/index.ts), então o
  // Next precisa transpilá-lo. É aditivo e afeta só o pacote nomeado.
  transpilePackages: ["@millead/video-contracts"],
```

- [ ] **Step 3: Verificar que o build aceita o pacote**

Run: `pnpm --filter @millead/web build`
Expected: build conclui sem erro. Se falhar com "Cannot find module '@millead/video-contracts'", o Step 1 não foi instalado — rode `pnpm install` na raiz.

- [ ] **Step 4: Acrescentar o item no menu**

Em `apps/web/src/components/shell/nav-items.ts`:

1. No import de `lucide-react`, acrescente `Clapperboard` em ordem alfabética (entre `Calendar` e `ClipboardList`).
2. Na seção `"Prospecção"`, acrescente o item depois de "Diretor criativo":

```ts
      { label: "Vídeos", href: "/videos", icon: Clapperboard, permission: "leads:read" },
```

- [ ] **Step 5: Criar a lista de cenas**

`apps/web/src/features/video-studio/components/scene-list.tsx`:

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { sceneLabel } from "../scenes";
import type { FormScene } from "../types";

interface SceneListProps {
  scenes: FormScene[];
  onChange: (scenes: FormScene[]) => void;
}

export function SceneList({ scenes, onChange }: SceneListProps) {
  function update(id: string, patch: Partial<FormScene>) {
    onChange(scenes.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)));
  }

  return (
    <ul className="divide-y rounded-md border">
      {scenes.map((scene) => (
        <li key={scene.id} className="flex items-center gap-3 p-3">
          <Checkbox
            checked={scene.enabled}
            onCheckedChange={(checked) => update(scene.id, { enabled: checked === true })}
            aria-label={`Incluir a cena ${sceneLabel(scene)}`}
          />
          <span className={scene.enabled ? "flex-1" : "flex-1 text-muted-foreground"}>
            {sceneLabel(scene)}
          </span>
          <Input
            type="number"
            min={1}
            value={scene.durationSec}
            disabled={!scene.enabled}
            onChange={(event) =>
              update(scene.id, { durationSec: Math.max(1, Number(event.target.value) || 1) })
            }
            className="w-20"
            aria-label={`Duração da cena ${sceneLabel(scene)} em segundos`}
          />
          <span className="text-sm text-muted-foreground">s</span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Criar a página**

`apps/web/src/app/(app)/videos/page.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildBrief, scaleDurations, totalDuration, totalWordBudget } from "@/features/video-studio/build-brief";
import { buildPrompt } from "@/features/video-studio/build-prompt";
import { SceneList } from "@/features/video-studio/components/scene-list";
import { TEMPLATES, templateById } from "@/features/video-studio/templates";
import type { FormScene, TotalDuration, VideoFormat } from "@/features/video-studio/types";

const DURACOES: TotalDuration[] = [15, 30, 45, 60];
const FORMATOS: VideoFormat[] = ["9:16", "16:9", "1:1"];

export default function VideosPage() {
  const [businessName, setBusinessName] = useState("");
  const [url, setUrl] = useState("");
  const [segment, setSegment] = useState("");
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [totalDurationSec, setTotalDurationSec] = useState<TotalDuration>(30);
  const [format, setFormat] = useState<VideoFormat>("9:16");
  const [scenes, setScenes] = useState<FormScene[]>(
    TEMPLATES[0]!.defaultScenes.map((s) => ({ ...s })),
  );

  const template = templateById(templateId)!;

  function trocarTemplate(id: string) {
    const novo = templateById(id);
    if (!novo) return;
    setTemplateId(id);
    setScenes(scaleDurations(novo.defaultScenes.map((s) => ({ ...s })), totalDurationSec));
  }

  function redistribuir(alvo: TotalDuration) {
    setTotalDurationSec(alvo);
    setScenes(scaleDurations(scenes, alvo));
  }

  const { prompt, erro } = useMemo(() => {
    try {
      const brief = buildBrief(
        {
          businessName,
          url,
          segment,
          templateId,
          totalDurationSec,
          format,
          scenes,
          narrationMode: "auto",
          narrationText: "",
          customInstructions: "",
        },
        template,
        new Date().toISOString(),
      );
      return { prompt: buildPrompt(brief, template), erro: null as string | null };
    } catch (err) {
      return { prompt: "", erro: err instanceof Error ? err.message : String(err) };
    }
  }, [businessName, url, segment, templateId, totalDurationSec, format, scenes, template]);

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa</Label>
          <Input id="empresa" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL do site</Label>
          <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="segmento">Segmento (opcional)</Label>
          <Input id="segmento" value={segment} onChange={(e) => setSegment(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={trocarTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
          <div className="space-y-2">
            <Label>Duração</Label>
            <Select
              value={String(totalDurationSec)}
              onValueChange={(v) => redistribuir(Number(v) as TotalDuration)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURACOES.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATOS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Cenas</Label>
            <span className="text-sm text-muted-foreground">
              {totalDuration(scenes)}s · {totalWordBudget(scenes)} palavras
            </span>
          </div>
          <SceneList scenes={scenes} onChange={setScenes} />
          <Button variant="outline" size="sm" onClick={() => redistribuir(totalDurationSec)}>
            Redistribuir para {totalDurationSec}s
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Prompt</h2>
          <Button size="sm" onClick={copiar} disabled={!prompt}>Copiar</Button>
        </div>
        {erro ? (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">{erro}</p>
        ) : (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
            {prompt}
          </pre>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Prefill por empresa cadastrada**

Reuso do `CompanyCombobox`, no mesmo padrão do `landing-pages/page.tsx:193-210`. Acrescente aos imports da página:

```tsx
import { useEffect } from "react";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCompany } from "@/features/companies/hooks";
```

O estado e o efeito, junto dos outros `useState`:

```tsx
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const { data: company } = useCompany(companyId);

  // Só preenche campo ainda vazio -- nunca sobrescreve o que você digitou.
  // A URL NÃO vem daqui: o tipo `Company` não tem site (os endereços vivem na
  // relação CompanyWebsite, que o `useCompany` não devolve).
  useEffect(() => {
    if (!company) return;
    setBusinessName((atual) => atual || company.name);
    setSegment((atual) => atual || company.segment || "");
  }, [company]);
```

E o combobox no topo do formulário, antes do campo Empresa:

```tsx
        <div className="space-y-2">
          <Label>Puxar de uma empresa cadastrada (opcional)</Label>
          <CompanyCombobox value={companyId} onChange={(id) => setCompanyId(id)} />
        </div>
```

- [ ] **Step 8: Verificar na tela**

Run: `pnpm --filter @millead/web dev`
Abra `http://localhost:3000/videos`, preencha "Kavita Drones" e `https://kavita.com.br`, e confirme:
1. O prompt aparece à direita e muda ao trocar de template.
2. Trocar a duração para 45s redistribui as cenas e o contador mostra `45s`.
3. Desmarcar uma cena reduz o total, e as outras cenas **não** mudam de duração.
4. Com a URL vazia, aparece o aviso âmbar em vez do prompt.
5. Escolher uma empresa no combobox preenche o nome, e **não** apaga o que você já tinha digitado.

- [ ] **Step 9: Rodar type-check, lint e build**

Run: `pnpm --filter @millead/web type-check && pnpm --filter @millead/web lint && pnpm --filter @millead/web build`
Expected: os três sem erro.

- [ ] **Step 10: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: tela /videos gerando o prompt do Video Studio"
```

> O `pnpm-lock.yaml` entra porque o Step 1 acrescentou uma dependência de workspace.

---

### Task 6: Zoom, arrasto, narração e download do brief

**Files:**
- Modify: `apps/web/src/features/video-studio/components/scene-list.tsx`
- Modify: `apps/web/src/app/(app)/videos/page.tsx`
- Create: `apps/web/src/features/video-studio/components/narration-fields.tsx`

**Interfaces:**
- Consumes: tudo da Task 5, mais `zoomTargetsFor` (Task 2) e `promptFileName` (Task 4).
- Produces: a tela completa conforme a spec.

**Sem teste automatizado** (mesma razão da Task 5): a lógica testável já está coberta nas Tasks 3 e 4.

- [ ] **Step 1: Acrescentar chips de zoom e arrasto na lista de cenas**

Substitua `apps/web/src/features/video-studio/components/scene-list.tsx` inteiro por:

```tsx
"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { sceneLabel, zoomTargetsFor } from "../scenes";
import type { FormScene } from "../types";

interface SceneRowProps {
  scene: FormScene;
  onChange: (patch: Partial<FormScene>) => void;
}

function SceneRow({ scene, onChange }: SceneRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: scene.id,
  });
  const alvos = zoomTargetsFor(scene);

  function alternarAlvo(id: string) {
    const marcados = scene.zoomTargets.includes(id)
      ? scene.zoomTargets.filter((t) => t !== id)
      : [...scene.zoomTargets, id];
    onChange({ zoomTargets: marcados });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="space-y-2 p-3"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          aria-label={`Reordenar a cena ${sceneLabel(scene)}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Checkbox
          checked={scene.enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked === true })}
          aria-label={`Incluir a cena ${sceneLabel(scene)}`}
        />
        <span className={scene.enabled ? "flex-1" : "flex-1 text-muted-foreground"}>
          {sceneLabel(scene)}
        </span>
        <Input
          type="number"
          min={1}
          value={scene.durationSec}
          disabled={!scene.enabled}
          onChange={(event) =>
            onChange({ durationSec: Math.max(1, Number(event.target.value) || 1) })
          }
          className="w-20"
          aria-label={`Duração da cena ${sceneLabel(scene)} em segundos`}
        />
        <span className="text-sm text-muted-foreground">s</span>
      </div>

      {/* Cena sem alvo de zoom (notebook, logo) não mostra o campo. */}
      {scene.enabled && alvos.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-10">
          {alvos.map((alvo) => {
            const marcado = scene.zoomTargets.includes(alvo.id);
            return (
              <button key={alvo.id} type="button" onClick={() => alternarAlvo(alvo.id)}>
                <Badge variant={marcado ? "default" : "outline"}>{alvo.label}</Badge>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}

interface SceneListProps {
  scenes: FormScene[];
  onChange: (scenes: FormScene[]) => void;
}

export function SceneList({ scenes, onChange }: SceneListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const de = scenes.findIndex((s) => s.id === active.id);
    const para = scenes.findIndex((s) => s.id === over.id);
    if (de === -1 || para === -1) return;
    const reordenadas = [...scenes];
    const [movida] = reordenadas.splice(de, 1);
    reordenadas.splice(para, 0, movida!);
    onChange(reordenadas);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y rounded-md border">
          {scenes.map((scene) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              onChange={(patch) =>
                onChange(scenes.map((s) => (s.id === scene.id ? { ...s, ...patch } : s)))
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
```

- [ ] **Step 2: Criar os campos de narração**

`apps/web/src/features/video-studio/components/narration-fields.tsx`:

```tsx
"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NarrationMode } from "../types";

interface NarrationFieldsProps {
  mode: NarrationMode;
  text: string;
  customInstructions: string;
  wordBudget: number;
  onChange: (patch: {
    mode?: NarrationMode;
    text?: string;
    customInstructions?: string;
  }) => void;
}

const ROTULOS: Record<NarrationMode, string> = {
  auto: "Automática",
  manual: "Escrever manualmente",
  custom: "Instruções próprias",
};

function contarPalavras(texto: string): number {
  return texto.trim() ? texto.trim().split(/\s+/).length : 0;
}

export function NarrationFields({
  mode,
  text,
  customInstructions,
  wordBudget,
  onChange,
}: NarrationFieldsProps) {
  const palavras = contarPalavras(text);
  const estourou = mode === "manual" && palavras > wordBudget;

  return (
    <div className="space-y-2">
      <Label>Narração</Label>
      <Select value={mode} onValueChange={(v) => onChange({ mode: v as NarrationMode })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(ROTULOS) as NarrationMode[]).map((m) => (
            <SelectItem key={m} value={m}>{ROTULOS[m]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mode === "manual" && (
        <>
          <Textarea
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={6}
            placeholder="Escreva a narração do vídeo."
            aria-label="Texto da narração"
          />
          <p className={estourou ? "text-sm text-amber-600" : "text-sm text-muted-foreground"}>
            {palavras} de {wordBudget} palavras
            {estourou ? " — acima do orçamento; a narração vai passar do tempo do vídeo." : ""}
          </p>
        </>
      )}

      {mode === "custom" && (
        <Textarea
          value={customInstructions}
          onChange={(e) => onChange({ customInstructions: e.target.value })}
          rows={4}
          placeholder="Ex.: tom bem-humorado, citar o atendimento no mesmo dia."
          aria-label="Instruções próprias para a narração"
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Ligar narração e download na página**

Em `apps/web/src/app/(app)/videos/page.tsx`, faça quatro mudanças:

1. Acrescente aos imports:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { promptFileName } from "@/features/video-studio/build-prompt";
import { NarrationFields } from "@/features/video-studio/components/narration-fields";
import type { NarrationMode } from "@/features/video-studio/types";
```

2. Acrescente o estado da narração, junto dos outros `useState`:

```tsx
  const [narrationMode, setNarrationMode] = useState<NarrationMode>("auto");
  const [narrationText, setNarrationText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
```

3. Troque o `useMemo` inteiro por este, que agora devolve também o brief:

```tsx
  const { prompt, brief, erro } = useMemo(() => {
    try {
      const gerado = buildBrief(
        {
          businessName,
          url,
          segment,
          templateId,
          totalDurationSec,
          format,
          scenes,
          narrationMode,
          narrationText,
          customInstructions,
        },
        template,
        new Date().toISOString(),
      );
      return {
        prompt: buildPrompt(gerado, template),
        brief: gerado,
        erro: null as string | null,
      };
    } catch (err) {
      return {
        prompt: "",
        brief: null,
        erro: err instanceof Error ? err.message : String(err),
      };
    }
  }, [
    businessName,
    url,
    segment,
    templateId,
    totalDurationSec,
    format,
    scenes,
    template,
    narrationMode,
    narrationText,
    customInstructions,
  ]);
```

4. Acrescente a função de download, ao lado de `copiar()`:

```tsx
  function baixar(conteudo: string, nome: string, tipo: string) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);
  }
```

- [ ] **Step 4: Trocar o painel de saída por abas**

Substitua a `<section>` da direita (a que hoje mostra só o prompt) por:

```tsx
      <section className="space-y-3">
        {erro ? (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">{erro}</p>
        ) : (
          <Tabs defaultValue="prompt">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="prompt">Prompt</TabsTrigger>
                <TabsTrigger value="brief">Brief</TabsTrigger>
              </TabsList>
              <span className="text-sm text-muted-foreground">
                {brief!.totalDurationSec}s · {brief!.wordBudget} palavras
              </span>
            </div>

            <TabsContent value="prompt" className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" onClick={copiar}>Copiar</Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => baixar(prompt, promptFileName(brief!), "text/markdown")}
                >
                  Baixar .md
                </Button>
              </div>
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                {prompt}
              </pre>
            </TabsContent>

            <TabsContent value="brief" className="space-y-3">
              <Button
                size="sm"
                onClick={() =>
                  baixar(
                    `${JSON.stringify(brief, null, 2)}\n`,
                    `videobrief-${brief!.id}.json`,
                    "application/json",
                  )
                }
              >
                Baixar videobrief.json
              </Button>
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                {JSON.stringify(brief, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        )}
      </section>
```

- [ ] **Step 5: Acrescentar os campos de narração no formulário**

No fim da `<section>` da esquerda, depois do botão "Redistribuir":

```tsx
        <NarrationFields
          mode={narrationMode}
          text={narrationText}
          customInstructions={customInstructions}
          wordBudget={totalWordBudget(scenes)}
          onChange={(patch) => {
            if (patch.mode !== undefined) setNarrationMode(patch.mode);
            if (patch.text !== undefined) setNarrationText(patch.text);
            if (patch.customInstructions !== undefined) setCustomInstructions(patch.customInstructions);
          }}
        />
```

- [ ] **Step 6: Verificar na tela**

Run: `pnpm --filter @millead/web dev`
Em `http://localhost:3000/videos`, confirme:
1. Arrastar uma cena pela alça muda a ordem, e o prompt renumera.
2. Marcar/desmarcar um chip de zoom muda a linha `zoom:` daquela cena no prompt.
3. As cenas "Notebook abrindo" e "Logo e CTA" **não** mostram chips.
4. Modo "Escrever manualmente" mostra o textarea e o contador fica âmbar ao passar do orçamento.
5. Modo "Instruções próprias" com o campo vazio mostra o aviso de erro em vez do prompt.
6. A aba Brief baixa um `videobrief-*.json`.

- [ ] **Step 7: Rodar type-check, lint, testes e build**

Run: `pnpm --filter @millead/web type-check && pnpm --filter @millead/web lint && pnpm --filter @millead/web test && pnpm --filter @millead/web build`
Expected: os quatro sem erro.

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat: zoom, arrasto, narração e download do brief"
```

---

### Task 7: Aceite ponta a ponta com a Kavita

**Files:**
- Create: `docs/superpowers/plans/2026-07-29-video-studio-prompt-mestre-resultado.md`

**Interfaces:**
- Consumes: a tela pronta das Tasks 5 e 6.
- Produces: a evidência de que os critérios de aceite da spec foram cumpridos.

- [ ] **Step 1: Gerar o material da Kavita**

Na tela `/videos`: empresa "Kavita Drones", URL `https://kavita.com.br`, template **Institucional**, 30 segundos, formato 9:16. Copiar o prompt e baixar o `videobrief.json`.

- [ ] **Step 2: Rodar o prompt no Claude Code**

Colar o prompt numa sessão do Claude Code e guardar a resposta JSON.

- [ ] **Step 3: Conferir o orçamento de palavras**

Para cada cena da resposta, contar as palavras de `texto` e comparar com o orçamento que o prompt declarou. Anotar as que estouraram e por quanto. Se estourar em mais da metade das cenas, o problema é o prompt, não o modelo — registre isso como achado.

- [ ] **Step 4: Validar o brief baixado**

Crie `packages/video-contracts/validar-brief.mjs` (arquivo temporário, apagado no fim do passo):

```js
import { readFileSync } from "node:fs";
import { VideoBriefSchema } from "./src/brief.js";

const caminho = process.argv[2];
VideoBriefSchema.parse(JSON.parse(readFileSync(caminho, "utf8")));
console.log("brief válido");
```

Run: `pnpm --filter @millead/video-contracts exec tsx validar-brief.mjs "<caminho-do-json-baixado>"`
Expected: `brief válido`. Se o zod reclamar, o bug está no `buildBrief` — corrija lá, não no JSON.

Depois: `rm packages/video-contracts/validar-brief.mjs`

- [ ] **Step 5: Registrar o resultado**

Criar `docs/superpowers/plans/2026-07-29-video-studio-prompt-mestre-resultado.md`:

```markdown
# Resultado — Prompt Mestre do Video Studio

Data: <preencher com a data da execução>

## Critério de aceite da spec

| # | Critério | Status | Evidência |
| - | -------- | ------ | --------- |
| 1 | Prompt do Institucional gerado para a Kavita | | |
| 2 | Narração voltou dentro do orçamento de palavras | | cenas que estouraram: ... |
| 3 | videobrief.json valida no zod sem ajuste manual | | |
| 4 | `next build` do web passa com o transpilePackages | | |

## O que o prompt ainda erra

<preencher — vira a próxima rodada de ajuste dos templates>
```

Preencher com o resultado real, incluindo o que deu errado.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers
git commit -m "docs: resultado do aceite do Prompt Mestre"
```

---

## Notas de execução

**Ordem obrigatória:** 1 → 2 → 3 → 4 → 5 → 6 → 7. A Task 2 depende do contrato da Task 1; as Tasks 3 e 4 dependem do catálogo da Task 2; as telas dependem das funções puras.

**O que este plano NÃO faz** (está na spec, seção "Fora de escopo"): compilador `VideoBrief + Snapshot → VideoProject`, crawler, Remotion, Higgsfield, templates editáveis pela tela, colar o JSON do Claude de volta no MilLead, preview do vídeo, e salvar/duplicar/versionar brief.

**Depois deste plano:** volta o plano do crawler, `docs/superpowers/plans/2026-07-29-video-studio-contratos.md`, que está parado nas Tasks 3 a 10.
