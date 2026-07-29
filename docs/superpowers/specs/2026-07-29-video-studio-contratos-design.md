# Video Studio — contratos e crawler — design

> Primeira fatia do módulo de vídeo do MilLead: os contratos de dados que sustentam
> todo o pipeline (URL → análise → projeto → MP4) e o crawler que produz o primeiro
> deles. Sem UI, sem IA, sem Remotion, sem render.
>
> Data: 2026-07-29 · Status: especificado (não implementado)
>
> Alvo de teste em tudo: **milweb.com.br** — site próprio, sem risco de lead falso no
> CRM de cliente nem dado pessoal real em captura.

## Problema

O MilLead entrega sites. Cada site entregue vira um Reel de divulgação editado à mão,
tarefa que se repete inteira a cada cliente. A ideia é um módulo que compile um vídeo
a partir da URL do site.

O módulo completo — crawler, inspector visual, editor de timeline, roteiro por IA,
narração, preview, render — são seis subsistemas independentes e não cabem numa spec
só. Esta spec cobre **a fundação de dados e o produtor do primeiro dado**. As demais
partes ganham seu próprio ciclo spec → plano → implementação.

A razão de começar pelos contratos: o pipeline inteiro é um compilador (Snapshot +
Projeto → MP4). Compilador sem representação intermediária estável vira lama. E a
razão de não parar nos contratos: **contrato sem produtor é ficção** — só se sabe se o
schema presta quando um site de verdade tenta preenchê-lo.

## Decisões

| Questão                              | Decisão                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Escopo desta spec                    | Contratos **+** crawler que preenche o Snapshot                                                 |
| Viewport do crawler v1               | **Desktop 1920×1080**; mobile é outro Snapshot da mesma URL, não um campo novo                   |
| Granularidade do Snapshot            | **Uma URL, um viewport, um instante** — imutável, datado; site = coleção de snapshots            |
| Persistência v1                      | **Disco local**, `captures/<snapshotId>/`. Sem Prisma, sem Blob, sem migration                  |
| Onde moram os rótulos semânticos     | **Camada Annotation separada** — não dentro do Snapshot, não dentro do Projeto                  |
| Unidade de tempo                     | Projeto em **segundos** (humano), Manifesto em **frames** (máquina)                             |
| Manifesto                            | **Derivado a cada build, nunca persistido, nunca editado à mão**                                |

### Por que a Annotation é uma camada separada

Três opções foram consideradas:

1. **Rótulos dentro do Snapshot** — mata a propriedade que faz o Snapshot valer: ele
   deixa de ser o registro fiel do site. Melhorar o prompt e reanalisar passaria a
   alterar o Snapshot, e o detector de "o site mudou?" acusaria mudança que foi só a
   IA mudando de ideia.
2. **Rótulos dentro do Projeto** — morre no requisito de **várias versões do mesmo
   vídeo** (uma focada em produtos, outra em serviços, outra em captação). Cada versão
   refaria a análise do zero e pagaria token de novo, sem motivo.
3. **Camada separada** ✅ — Snapshot é fato determinístico; Annotation é interpretação:
   descartável, re-executável sem reabrir o site, e carrega a própria proveniência
   (modelo e versão de prompt).

```
Snapshot      o que o site É           determinístico, imutável, datado
   ↓
Annotation    o que aquilo SIGNIFICA   probabilístico, descartável, versionado por modelo
   ↓
Project       como CONTAR a história   decisão humana — timeline, narração, formato
   ↓
Manifest      o que PRODUZIR           derivado; o "bytecode" do compilador
```

## Arquitetura

Dois pacotes novos no monorepo. **`apps/api` não é tocado neste escopo.**

```
packages/video-contracts     schemas zod dos 4 objetos + tipos inferidos
                             zero dependência pesada; importável por api, web e runner

apps/runner                  CLI Node + Playwright
                             pnpm capture <url>  →  captures/<snapshotId>/
                             depende de video-contracts; valida a própria saída
```

### Regras transversais

- **Determinismo.** Nada de `Date.now()` ou `Math.random()` na geração. O único
  timestamp permitido é o `capturedAt`, gravado uma vez no topo do Snapshot. Mesma
  entrada deve produzir a mesma saída — é o que permitirá "re-renderizar em 4K" gerar
  o mesmo vídeo em vez de um vídeo novo.
- **Sem cumplicidade com o alvo.** O crawler não pode depender de nenhum atributo que
  a MilWeb tenha posto no HTML de propósito (`data-video-section` e afins). Se
  funcionar em milweb.com.br só porque o site é nosso, não funcionou. Antes de fechar
  a implementação, rodar uma captura contra um site que ninguém aqui escreveu.
- **O Manifesto nunca é persistido.** É compilado a cada build e descartado.

### Armadilha do deploy (achado no repo)

O `render.yaml` roda `pnpm install --frozen-lockfile` **na raiz**, o que instala todos
os workspaces — inclusive o `apps/runner`. O `package.json` da raiz usa
`onlyBuiltDependencies` (pnpm 10) e o Playwright **não** está na lista, então o
download do Chromium não dispara sozinho em lugar nenhum.

- Na máquina de desenvolvimento: `pnpm exec playwright install chromium`, passo
  explícito documentado no README do runner.
- No Render: **nunca adicionar `playwright` à allowlist `onlyBuiltDependencies`** —
  o build do free tier tentaria baixar ~150 MB de browser e quebraria a API que está
  em produção.

## O pacote de captura

```
captures/<snapshotId>/
  snapshot.json        o contrato inteiro; único alvo de validação zod
  dom.html             HTML servido, cru — permite reprocessar sem reabrir o site
  tiles/000-y0.webp    sequência de telas, uma por passo de scroll
  tiles/001-y1080.webp
  sections/hero.webp   miniatura por seção (Inspector e preview, mais adiante)
```

`sections.json`, `bounding-boxes.json`, `viewport.json`, `metadata.json` e
`colors.json` **não** existem como arquivos separados: são recortes de um objeto só, e
separá-los cria a chance de ficarem inconsistentes entre si. Tudo vive no
`snapshot.json`. `fonts.json` fica deliberadamente fora (ver Fora de escopo).

### Estratégia de captura

1. Validar a URL (ver Erros → SSRF) **antes** do `page.goto`.
2. Rolar até o fim da página — força o lazy-load a resolver.
3. Voltar ao topo, esperar fontes e rede assentarem.
4. Capturar tile a tile: rolar um viewport, esperar assentar, fotografar, gravar o
   `scrollY` junto.
5. Para cada seção: `scrollIntoView`, esperar assentar, screenshot **do elemento**.
6. Validar o `snapshot.json` no zod e só então renomear o diretório temporário.

**Por que tiles e não `fullPage: true`:** o screenshot de página inteira do Playwright
rola a página por dentro e sai quebrado em site com `pin`/sticky — tombo já pago no
kavita-institucional. A captura em tiles funciona com ScrollTrigger e produz
exatamente o artefato que a cena de scroll vai consumir depois.

**Por que a miniatura da seção não é recorte do tile:** elemento que atravessa a
fronteira de dois tiles sairia cortado.

**Coordenadas em espaço de documento** (`{x, y, w, h}` absoluto na página), não em
espaço de viewport. É o que permite à cena "zoom no `#products`" saber em qual tile e
em que altura aquilo vive.

### O que conta como seção (determinístico, sem IA)

Filhos diretos de `<main>`/`<body>`, mais qualquer `<section>`, `<header>`, `<footer>`
e `<article>`, filtrados por visibilidade e altura mínima.

### Fingerprint

Hash de `tag + id + texto normalizado + basename do src da imagem + posição entre
irmãos`. Custa três linhas agora e é o que vai sustentar o Asset Graph ("o Produto B
sumiu do site, deseja substituir?") no futuro. **Seletor CSS não é identidade** —
classe Tailwind muda, ordem muda, id é renomeado. O fingerprint é gravado desde o dia
1; a UI de diff e substituição fica para depois de sentirmos a dor de re-renderizar um
projeto com o site alterado.

## Os contratos

Todos com `version: 1` no topo.

### Snapshot

Árvore **achatada** com `parentId` — valida melhor no zod e permite referenciar
qualquer nó por `nodeId` sem caminhar a árvore.

```ts
Snapshot {
  version: 1
  id: string            // "milweb.com.br-home-desktop-202607291432", derivado de capturedAt
  url: string
  capturedAt: string    // ISO — o único timestamp da geração
  http: { status, finalUrl, redirects[] }
  page: { title, description, lang }
  capture: {
    viewport: { width: 1920, height: 1080, dpr: 1 }
    userAgent, locale, timezone     // fixos, senão a captura não é reproduzível
    pageHeight: number
    tiles: [{ file, scrollY, height }]
  }
  theme: { colors: [{ hex, weight }] }   // amostragem dos backgrounds mais frequentes
  warnings: string[]
  nodes: Node[]
}

Node {
  nodeId, parentId: string | null
  fingerprint: string               // identidade que sobrevive à mudança de classe
  selector: string                  // conveniência, NÃO identidade
  tag, id?, classes[], role?, ariaLabel?
  box: { x, y, w, h }               // espaço de documento
  visible: boolean
  isSection: boolean
  text?: string                     // truncado
  media?: { type: "img" | "video", src, naturalW, naturalH }
  counts?: { images, videos, buttons, inputs, links }
  screenshot?: string               // só quando isSection
}
```

### Annotation

```ts
Annotation {
  version: 1
  id, snapshotId, generatedAt
  model: string, promptVersion: string
  labels: [{ nodeId, label, kind, certainty, evidence: string[] }]
  suggestion: { nodeIds: string[], durationSec: number, rationale: string }
}
```

`certainty` é `"alta" | "media" | "baixa"`, **derivada de `evidence`** — a lista de
sinais determinísticos que dispararam (tem `id="hero"`, é a primeira seção, tem `<h1>`,
bate com padrão conhecido). Nunca um número auto-relatado pelo modelo: LLM não produz
confiança calibrada, e um "98%" na tela é lido pelo usuário como probabilidade quando
não é. O Claude classifica; quem mede a certeza é o código.

### VideoProject

A única coisa que um humano edita. Referencia `snapshotIds` — **nunca uma URL**. É o
que faz o re-render ser reproduzível e "o site mudou" ser detectável em vez de
apodrecer em silêncio.

```ts
VideoProject {
  version: 1
  id, name, snapshotIds: string[]
  format: "9:16" | "16:9" | "1:1"
  fps: number
  scenes: Scene[]
  voice: { provider, voiceId, lines: [{ sceneId, text }] } | null
}

Scene =
  | { id, type: "site",   source: { snapshotId, nodeId },
      shot: "scroll" | "zoom" | "hold", durationSec,
      hidden: nodeId[],            // vira injeção de CSS na captura pesada
      caption? }
  | { id, type: "studio", component: "notebook" | "google" | "whatsapp" | "logo",
      props: {...}, durationSec }
```

As cenas `studio` são renderizadas em React, **nunca gravadas**: elimina mudança de
layout do Google, captcha, idioma do navegador, resolução variável, inconsistência
visual — e, principalmente, dado pessoal real dentro do vídeo.

O campo `hidden` é o que torna literal o "grave apenas o que eu escolhi": a seleção
vira `display:none` injetado antes da captura pesada. Como esconder elemento colapsa
layout, o padrão é **enquadrar** (crop/zoom na caixa do que foi marcado) e o esconder
é opção explícita.

### RenderManifest

```ts
RenderManifest {
  version: 1
  projectId, compiledFrom: { snapshotIds[], projectVersion }
  resolution: { w, h }, fps, totalFrames
  clips: [{ sceneId, startFrame, endFrame, component, props }]
  audio: [{ file, startFrame }]
}
```

Propriedade que define o Manifesto: **não sobra nenhum seletor, nenhuma URL, nenhum
segundo.** Tudo já resolvido em caminho de arquivo, número de frame e caixa em pixel.
Se o runner precisar consultar o site ou o banco para renderizar, o compilador falhou.

## Erros

**Pacote parcial nunca existe.** O crawler escreve em `captures/.tmp-<id>/` e só
renomeia para `captures/<id>/` depois que o zod validar o `snapshot.json`. Falhou:
imprime o erro do zod, apaga o temporário, sai com código ≠ 0.

| Situação                          | Comportamento                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Site inacessível / timeout / ≠ 200 | Falha explícita, reaproveitando as mensagens em português do `http-site-auditor.ts`  |
| Endereço interno / IP privado      | Recusa **antes** do `page.goto` (ver abaixo)                                         |
| Página infinita                    | Teto de 40 tiles (~43 mil px) e teto de bytes; estourou, falha com mensagem clara     |
| Zero seções detectadas             | **Não é erro** — grava tudo com `isSection: false` e registra em `warnings[]`        |
| Saída inválida no zod              | Não grava nada; erro do zod no stdout; exit ≠ 0                                      |
| Chromium pendurado                 | `try/finally` com `browser.close()` + timeout global no processo                     |

### SSRF

Buraco real e explícito: a guarda de hoje mora no `safe-fetch.ts`, e o Playwright
**não passa por ela** — `page.goto` fala direto com a rede. A validação (resolver DNS,
recusar IP privado, limitar redirects) roda antes do `goto`. Enquanto o runner for CLI
local o risco é baixo; no dia em que a API aceitar URL de terceiro, vira crítico. A
checagem nasce junto para não depender de alguém lembrar depois.

## Testes

Vitest — já é o runner de `apps/api` e `apps/web`.

**Unitário**

- Schemas contra fixtures válidos e inválidos.
- **Estabilidade do fingerprint**: trocar classe Tailwind → mesmo hash; trocar o texto
  → hash diferente. É o teste que decide se o Asset Graph será possível um dia.
- Detecção de seção sobre HTML fixture.

**Integração, offline**

O teste sobe um servidor estático com HTMLs fixture e roda o crawler contra
`localhost`. Determinístico, sem rede, roda em CI. **milweb.com.br não entra no CI** —
site muda, rede falha, e teste intermitente é pior que teste nenhum.

**Fumaça, manual e documentado**

`pnpm capture https://milweb.com.br`, seguido da regra que vale mais que todas: **abrir
os tiles e as miniaturas e olhar.** Captura de site com scroll animado é exatamente o
caso em que tudo passa no código e o resultado visual está quebrado.

### Critério de aceite da spec

1. Rodar contra milweb.com.br produz um pacote que valida no zod.
2. As seções da home aparecem identificadas.
3. As caixas conferem com os tiles a olho nu.
4. O mesmo comando rodado duas vezes gera snapshots idênticos exceto por `id` e
   `capturedAt`.

## Fora de escopo

Desta spec, com o motivo:

| Item                                 | Motivo                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Inspector visual, timeline, preview  | Subsistemas próprios; ciclo spec → plano separado                             |
| Passo Designer (Claude nomeando)     | Mistura risco determinístico com probabilístico numa spec só                  |
| Remotion, render, narração, legendas | Nada disso depende dos contratos estarem prontos primeiro                     |
| Viewport mobile                      | É outro Snapshot da mesma URL, não um campo novo; implementar dois dobra a superfície de bug na estreia |
| Múltiplas páginas por captura        | Snapshot é por URL; o Projeto é dono da relação entre elas                    |
| UI de diff / substituição de nó      | O dado (fingerprint) nasce agora; a feature, depois de sentir a dor           |
| `fonts.json`                         | Carregar webfont de terceiro no Remotion é um buraco próprio, com licenciamento junto |
| Vercel Blob / Prisma / migration     | Disco local no v1; a pasta mapeia 1:1 num prefixo do Blob depois              |
| Templates de Campanha                | Dependem do Projeto e do Inspector existirem                                  |
| Formato `.mlvideo` importável        | É uma linha no Postgres com `version`; o arquivo é exportação, não fundação   |

## Pendências a resolver antes de investir mais

- **Licença do Remotion.** Não é MIT. Ferramenta interna é um cenário; vender o vídeo
  ou o acesso ao Studio como serviço é outro. Confirmar em `remotion.dev/license`
  antes, não depois — é o único item que pode invalidar a stack inteira e o mais
  barato de checar.
- **API de narração.** Higgsfield aqui existe como MCP (ferramenta interativa); um
  worker precisa de API HTTP com chave. Confirmar se existe, ou assumir ElevenLabs —
  que ainda devolve timestamps por palavra e dispensa Whisper para legendas.
- **Legibilidade em 9:16.** Captura desktop num Reel vertical significa que crop e
  zoom são o mecanismo principal, não enfeite. Texto pequeno ilegível no celular é o
  risco número 1 do resultado final.
