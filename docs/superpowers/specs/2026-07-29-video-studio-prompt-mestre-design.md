# Video Studio — Prompt Mestre — design

> Segunda fatia do módulo de vídeo. Um configurador client-side no MilLead que
> produz dois artefatos: o **prompt** de narração pronto pra colar no Claude e o
> **`videobrief.json`** com a timeline decidida. Sem IA no servidor, sem render,
> sem banco.
>
> Data: 2026-07-29 · Status: especificado (não implementado)
>
> Fatia anterior: [contratos e crawler](2026-07-29-video-studio-contratos-design.md)
> (Tasks 1 e 2 já implementadas; o crawler vem depois desta fatia).

## Problema

O MilLead entrega sites, e cada site entregue merece um Reel de divulgação. A
fatia anterior desenhou o pipeline inteiro (URL → Snapshot → VideoProject → MP4),
mas o pipeline inteiro exige crawler, compilador e render — semanas antes de o
Rick ver qualquer coisa parecida com o produto.

Esta fatia entrega a parte que ele descreveu como o MVP: **um configurador com
templates de prompt**. Escolhe empresa, URL, tipo, duração e cenas; sai um prompt
pronto e um arquivo de projeto.

### A restrição que governa o desenho

Os critérios do Rick, ditos por ele: não gastar dinheiro, aproveitar Claude Code
e Higgsfield, virar mais um serviço vendável, e não dar trabalho recorrente.

O que custa dinheiro neste projeto é **render de vídeo em servidor** e **chamada
de IA em servidor**. Nada mais. Daí a divisão:

```
MilLead      configurador   client-side, zero infra, zero custo
Claude Code  fábrica        crawler + narração (Higgsfield) + Remotion, por cliente
```

Há precedente direto no próprio repo: o gerador de landing pages começou gerando
HTML por IA no servidor e foi trocado por um **gerador de prompt client-side**,
que funciona sem `ANTHROPIC_API_KEY`. Hoje ele é a feature `creative-director`
(2.643 linhas em `apps/web/src/features/creative-director/`). Esta fatia copia
aquela arquitetura.

> **Distinção que importa:** o `artifacts/video-prompts.ts` do `creative-director`
> gera prompts para o Higgsfield **inventar filmagem** cinematográfica. O Video
> Studio narra **gravação de tela real**. São features irmãs, não a mesma — o novo
> não entra dentro do `creative-director`.

## Decisões

| Questão                                  | Decisão                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| Onde vivem os 5 templates                | **Constante no código** (`templates.ts`), como o catálogo do `creative-director`               |
| Quem decide a timeline                   | **O formulário.** O Claude só escreve as palavras — e critica a timeline antes                 |
| Artefato de saída                        | **`VideoBrief`** (novo), não um `VideoProject` — não há Snapshot ainda, logo não há `nodeId`   |
| Controle de duração da narração          | **Orçamento de palavras** (~2,5 palavras/s em PT-BR), nunca instrução de tempo no prompt        |
| Infra                                    | Nenhuma. Client-side puro: sem rota de API, sem migração, sem env nova                          |

### Por que um `VideoBrief` e não um `VideoProject`

Uma cena de site no `VideoProject` é `source: { snapshotId, nodeId }`. O Prompt
Mestre roda **antes de o crawler existir**: não há Snapshot, não há `nodeId`.
"Zoom no botão do Hero" aqui é um item de lista fixa, não um elemento real.

Alternativas descartadas:

1. **Afrouxar o `VideoProject`** para aceitar `nodeId` nulo — o schema deixaria de
   garantir que um projeto é renderizável, e todo consumidor futuro passaria a
   checar "tem `nodeId` ou não?". Troca um arquivo por uma dúvida em todo lugar.
2. **`nodeId` de mentira** (`"@hero"`) resolvido depois — string mágica que só um
   pedaço do sistema entende, sem nada no schema impedindo que vaze até o render.

O `VideoBrief` é honesto sobre o que sabe: **intenção, não coordenada**. E é
exatamente o objeto que dá pra salvar, duplicar e versionar por cliente mais
tarde — o `.mlvideo` da conversa original, nascendo pequeno.

```
VideoBrief          intenção        slot "hero", zoom em "titulo"
   +
Snapshot            realidade       nodeId "n7", box {x,y,w,h}
   ↓  (compilador — fatia futura, não esta)
VideoProject        renderizável
```

O compilador tem um só trabalho difícil: casar `slot` com `nodeId`. Durações,
ordem, narração e formato já vêm decididos do Brief.

## Arquitetura

```
packages/video-contracts/src/brief.ts      VideoBriefSchema (zod) + tipo inferido

apps/web/src/features/video-studio/
  scenes.ts        catálogo de cenas por slot + alvos de zoom de cada uma
  templates.ts     os 5 templates de prompt, como objetos
  build-brief.ts   entrada do formulário → VideoBrief        (função pura)
  build-prompt.ts  VideoBrief + template → string             (função pura)
  types.ts

apps/web/src/app/(app)/videos/page.tsx     a tela
```

Duas funções puras, testáveis sem navegador, no molde do `build-dossier.ts`. A
página só junta formulário e saída.

### Mudança de infra: uma linha, com cuidado

`apps/web` hoje **não importa nenhum pacote de runtime do workspace** — só as
configs de eslint e tsconfig — e o `next.config.ts` não tem `transpilePackages`.
Como `@millead/video-contracts` publica `.ts` cru (`main: ./src/index.ts`), é
preciso acrescentar:

```ts
transpilePackages: ["@millead/video-contracts"],
```

É aditivo e afeta só o pacote nomeado, mas é a primeira vez que o web consome
código do workspace: exige um `next build` local antes de subir. O `zod` o web já
tem, na mesma faixa `^3.24.1`.

### Onde entra no produto

Item **"Vídeos"** na seção Prospecção da sidebar (`NAV_SECTIONS`), ao lado do
Gerador de sites — mesma categoria de ferramenta, a que produz material para o
cliente. O formulário aceita puxar nome e URL de uma Empresa cadastrada via
`CompanyCombobox`, componente que já existe e já é usado pelo Gerador de sites.

## O contrato `VideoBrief`

```ts
VideoBrief {
  version: 1
  id: string                 // "kavita-drones-lancamento" — slug do negócio + template
  createdAt: string          // ISO, carimbado no download
  business: { name: string, url: string, segment: string | null }
  template: { id: string, name: string }
  format: "9:16" | "16:9" | "1:1"
  fps: number                // 30 fixo no v1; existe porque o VideoProject exige
  totalDurationSec: number   // soma das cenas; redundante de propósito, dá pra conferir
  wordBudget: number         // SOMA dos orçamentos por cena, não round(total * 2.5) --
                             // as duas contas divergem por arredondamento, e a que
                             // vale é a que o prompt mostra cena a cena
  scenes: BriefScene[]
  narration: {
    mode: "auto" | "manual" | "custom"
    text: string | null                 // quando mode === "manual"
    customInstructions: string | null   // quando mode === "custom"
  }
}
```

União discriminada com **props explícitas por componente**, não uma sacola:

```ts
BriefScene =
  | { id, kind: "site", slot: SiteSlot, durationSec, zoomTargets: string[], note?: string }
  | { id, kind: "studio", component: "notebook", durationSec, zoomTargets: string[] }
  | { id, kind: "studio", component: "google",   durationSec, zoomTargets: string[],
      query: string, resultUrl: string }
  | { id, kind: "studio", component: "whatsapp", durationSec, zoomTargets: string[],
      company: string, message: string }
  | { id, kind: "studio", component: "logo",     durationSec, zoomTargets: string[],
      tagline: string | null }

SiteSlot = "hero" | "sobre" | "servicos" | "produtos" | "depoimentos"
         | "faq" | "formulario" | "rodape"
```

Isso corrige de graça um *minor* registrado na revisão da Task 2: lá o `props` da
cena de estúdio ficou `z.record(z.unknown())`, aceitando qualquer coisa. Aqui o
zod recusa uma cena `google` sem `query`.

As cenas `studio` são **renderizadas em React**, nunca gravadas — decisão herdada
da fatia anterior. Elimina captcha, mudança de layout do Google, idioma do
navegador, resolução variável e dado pessoal real dentro do vídeo.

## Os templates

```ts
PromptTemplate {
  id: string                    // "lancamento"
  name: string                  // "Lançamento de Site"
  description: string           // aparece no seletor
  defaultScenes: BriefScene[]   // a sequência e as durações que ele propõe
  body: string                  // o corpo com {{variáveis}}
}
```

| Template            | Sequência (segundos)                                                          | Total |
| ------------------- | ------------------------------------------------------------------------------ | ----- |
| Institucional       | notebook 3 · google 5 · hero 6 · sobre 5 · serviços 6 · formulário 3 · whatsapp 2 | 30s   |
| Lançamento de Site  | notebook 3 · google 6 · hero 8 · produtos 6 · whatsapp 4 · logo 3                | 30s   |
| Portfólio           | hero 6 · serviços 8 · produtos 15 · depoimentos 8 · formulário 5 · logo 3        | 45s   |
| Loja Virtual        | google 5 · hero 6 · produtos 18 · formulário 6 · whatsapp 6 · logo 4             | 45s   |
| Captação de Leads   | hero 6 · serviços 6 · formulário 10 · whatsapp 5 · logo 3                        | 30s   |

Trocar o preset de duração (15/30/45/60) **escala proporcionalmente** e devolve a
sobra do arredondamento à cena mais longa. Sem essa regra, 45s vira 44s ou 46s e
ninguém entende por quê.

## O prompt

Variáveis: `{{empresa}}`, `{{url}}`, `{{duracao}}`, `{{formato}}`,
`{{orcamentoPalavras}}`, `{{cenas}}`.

O `build-prompt.ts` substitui e **lança erro se sobrar algum `{{` no texto** —
variável não substituída vira prompt quebrado colado no Claude sem ninguém
perceber.

Esqueleto (o do Lançamento, encurtado):

```
Você escreve narração para vídeos curtos de divulgação de sites.

Empresa: {{empresa}}
Site: {{url}}
Formato: {{formato}} — {{duracao}} segundos

O vídeo é uma GRAVAÇÃO DE TELA já definida. A timeline abaixo está fechada;
você não a altera. Cada cena traz seu orçamento de palavras.

{{cenas}}

ANTES de narrar, se a ordem ou as durações prejudicarem o vídeo, diga em até
três frases. Se estiver bom, não invente crítica.

Regras da narração:
- Português do Brasil, frases curtas, linguagem comercial, sem jargão.
- Respeite o orçamento de palavras de cada cena. Total: {{orcamentoPalavras}} palavras.
- Cena pode ficar em silêncio se o texto não acrescentar nada.
- Nunca invente fato do negócio: prêmio, número de clientes, telefone ou endereço.
- Termine convidando a acessar o site.

Responda em JSON:
{ "criticas": [], "narracao": [ { "sceneId": "...", "texto": "...", "legenda": "..." } ] }
```

O `{{cenas}}` é montado pelo código, uma linha por cena, já com o orçamento:

```
1. [notebook] 3s — 8 palavras — notebook fechado abrindo
2. [google] 5s — 13 palavras — busca por "Kavita Drones"; zoom: barra, resultado
3. [hero] 8s — 20 palavras — topo do site; zoom: título, botão
```

### O prompt muda conforme o modo de narração

O corpo acima é o do modo **automática**. Os outros dois não geram um prompt
diferente do zero — trocam um bloco:

- **`manual`** — o texto que você escreveu entra no prompt e o pedido vira
  *ajuste*: "abaixo está a narração já escrita; encaixe-a nos orçamentos de
  palavras por cena, preservando o sentido e o tom. Não reescreva o que já cabe."
  O bloco de crítica continua.
- **`custom`** — as suas `customInstructions` são **acrescentadas** ao bloco de
  regras, nunca substituem as regras fixas (idioma, orçamento, não inventar fato
  do negócio). Instrução do usuário não pode desligar a trava que impede o modelo
  de inventar prêmio ou número de clientes.

### Por que orçamento de palavras e não tempo

Modelo de linguagem não sabe quanto tempo o texto dele leva falado. PT-BR narrado
em ritmo comercial dá ~2,5 palavras por segundo, então cada cena recebe
`round(durationSec * 2,5)` palavras. É o único controle que funciona — pedir "não
ultrapasse 30 segundos" produz narração de 50 segundos com confiança.

## A tela

Uma página, `/videos`, em duas colunas.

**Esquerda, o formulário:**

1. Empresa (via `CompanyCombobox` ou digitada) · URL · segmento (opcional)
2. Template (os 5) · duração (15/30/45/60) · formato (9:16 padrão)
3. **Lista de cenas** — vem do template; cada linha com checkbox, nome, duração
   editável e os alvos de zoom daquela cena como chips marcáveis. Reordenável por
   arrasto com `@dnd-kit/sortable`, que o web já tem.
4. Narração: automática · escrever manualmente · instruções próprias (o textarea
   aparece conforme a escolha)

**Direita, a saída ao vivo:** abas **Prompt** (copiar, baixar `.md`) e **Brief**
(baixar `videobrief.json`), com dois contadores sempre visíveis: duração total e
orçamento de palavras.

Duas regras de comportamento que evitam surpresa:

- **Desmarcar uma cena não reescala as outras.** O total cai, e você vê cair.
  Reescalar sozinho muda o ritmo do vídeo pelas costas do usuário. Um botão
  explícito, "redistribuir para 30s", faz isso quando você quiser.
- **Cena sem alvo de zoom não mostra o campo.** `notebook` não tem o que ampliar.

## Erros

Poucos, porque é tudo client-side e sem rede.

| Situação                            | Comportamento                                                                          |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| URL inválida                        | Aviso inline; o prompt segue gerável (é texto), mas o download do brief bloqueia com a mensagem do zod |
| Nenhuma cena marcada                | Os dois botões desabilitados, com o motivo escrito ao lado                               |
| Narração manual acima do orçamento  | Aviso âmbar com a contagem real. **Não bloqueia** — estourar é escolha do usuário        |
| Sobrou `{{variável}}` no prompt     | Lança erro. É bug de template, não erro de usuário: tem que aparecer no teste, não no cliente |

## Testes

Vitest, colocados junto do código, como o `build-dossier.test.ts` já faz.

- **`templates.test.ts`** — para cada um dos 5 templates, a soma das
  `defaultScenes` bate com o total declarado. É o teste que pega erro de digitação
  na tabela acima, escrita à mão.
- **`build-brief.test.ts`** — escalar para 15/30/45/60 dá soma **exata** nos 5
  templates (a sobra do arredondamento vai para a cena mais longa); desmarcar cena
  reduz o total sem mexer nas outras; alvo de zoom que não pertence ao slot é
  recusado.
- **`build-prompt.test.ts`** — todas as variáveis substituídas; lança se sobrar
  `{{`; a lista de cenas sai numerada com o orçamento certo por cena; o orçamento
  total é a soma dos por-cena; modo `manual` pede ajuste em vez de escrita; modo
  `custom` **acrescenta** as instruções sem remover nenhuma regra fixa.
- **`brief.test.ts`** (no pacote de contratos) — aceita brief completo; recusa
  `version` ≠ 1; recusa cena `google` sem `query`.

### Critério de aceite

1. Gerar o prompt do Institucional para a Kavita Drones e colar no Claude Code.
2. A narração volta dentro do orçamento de palavras.
3. Baixar o `videobrief.json` e ele validar no zod sem ajuste manual.
4. `next build` do web passa com o `transpilePackages` novo.

## Fora de escopo

| Item                                      | Motivo                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Compilador `VideoBrief + Snapshot → VideoProject` | Depende do crawler existir; é a fatia seguinte                       |
| Crawler (Tasks 3-10 da fatia anterior)    | Vem depois desta; o plano já está escrito                                   |
| Render no Remotion, narração no Higgsfield | Acontecem no Claude Code, por cliente — fora do MilLead por decisão de custo |
| Templates editáveis pela tela / no banco   | Migração + endpoints + seed manual em produção, para um usuário só          |
| Colar o JSON do Claude de volta no MilLead | O `videobrief.json` já sai completo; a narração é consumida no Claude Code   |
| Preview do vídeo                           | Sem Snapshot não há imagem para prever                                      |
| Salvar/duplicar/versionar brief            | É o passo que justifica banco; enquanto isso, o download resolve             |
