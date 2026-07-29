# Video Studio — Inspector: as cenas vêm do site — design

> A lista de cenas da tela `/videos` deixa de vir de um catálogo fixo e passa a vir do
> **Snapshot** produzido pelo crawler: seções reais, com miniatura, e alvos de zoom que
> são elementos de verdade, com a caixa medida.
>
> Data: 2026-07-29 · Status: especificado
>
> **Decisões tomadas sem consulta**, a pedido do Rick ("você dirige agora"). Documentadas
> aqui para revisão posterior.

## Problema

A tela `/videos` está no ar e funciona, mas as cenas que ela oferece vêm de uma lista
fechada de 8 slots (`hero`, `sobre`, `servicos`, `produtos`, `depoimentos`, `faq`,
`formulario`, `rodape`). Isso foi um palpite meu sobre o que um site costuma ter,
escrito quando não havia crawler para desmentir.

O crawler agora existe, e desmentiu na primeira execução. Rodado contra **milweb.com.br**,
ele achou **13 seções**:

| Seção real | Slot disponível hoje |
| ---------- | -------------------- |
| `top` | Hero ✓ |
| `about` | Sobre ✓ |
| `faq` | FAQ ✓ |
| `contact` | Formulário ✓ |
| `projects` | Produtos (aproximação) |
| `deliverables`, `why`, `raio-x`, `google`, `lab`, `process`, `tech`, `section-332` | **nenhum** |

**Mais da metade do site não tem como ser selecionada** — inclusive a `raio-x`, que é a
seção mais característica do site (calculadora, gauge de risco, gráficos).

O mesmo vale para o zoom: os chips são genéricos por tipo de seção ("Título", "Botão
principal", "Imagem de fundo"), não os elementos que existem naquela página. Comparação
medida no Snapshot real:

```
hoje:  Hero → "Título", "Botão principal", "Imagem de fundo"
real:  top  → h1("Seu site pode ser o melhor vendedor…"), img,
              a("Falar no WhatsApp"), a("Ver projetos")
       raio-x → h2("Depender só de rede social…"), button("Gerar meu diagnóstico"),
                button("24 horas"), button("7 dias")
       contact → a("Falar no WhatsApp"), a("Enviar e-mail")
```

## Decisões

| Questão | Decisão |
| ------- | ------- |
| De onde vem a lista de cenas | **Do Snapshot.** O catálogo fixo sai |
| `SiteSlot` como enum fechado | **Vira string livre** — o id (ou um slug do título) da seção real |
| Alvos de zoom | **Elementos reais do Snapshot**, com `box` medida junto |
| Snapshot é obrigatório? | **Sim, para cenas de site.** Sem ele, só cenas de estúdio |
| Como o Snapshot entra na tela | **Upload da pasta da captura**, client-side. Sem API |
| Papel dos 5 templates | Deixam de ditar a lista; viram **sugestão** que casa com o que foi achado e relata o que faltou |

### Por que o Snapshot passa a ser obrigatório para cenas de site

Não dá para filmar um site que ninguém abriu. Sem Snapshot não existe miniatura para
escolher, nem caixa para o zoom mirar — sobra o palpite que este documento está
corrigindo. Cenas de estúdio (notebook, Google, WhatsApp, logo) continuam disponíveis
sempre, porque são desenhadas em React e não dependem do site.

O caminho de uso passa a ser: `pnpm capture <url>` → arrastar a pasta da captura para a
tela → escolher olhando as miniaturas.

### Por que upload de pasta, e não uma rota de API

Manter o custo em zero é a restrição que governa este módulo desde o início. Um
`<input type="file" webkitdirectory>` lê `snapshot.json` **e** as miniaturas de
`sections/` no próprio navegador, gerando `blob:` URLs para exibição. Zero servidor,
zero armazenamento, zero chave.

Aceitar só o `snapshot.json` avulso também funciona — a tela mostra as seções sem
miniatura, com o texto do título como identificação.

## Contrato: o que muda no `VideoBrief`

A variante de cena de site passa a carregar realidade em vez de intenção:

```ts
// ANTES
{ id, kind: "site", slot: SiteSlot, durationSec, zoomTargets: string[], note? }

// DEPOIS
{
  id, kind: "site",
  source: { snapshotId: string, nodeId: string },   // de onde veio
  sectionId: string,        // "raio-x" -- id real, ou slug do título
  label: string,            // "Raio-X" -- o que aparece na tela
  screenshot: string | null,// "sections/raio-x.jpg", quando a captura trouxe
  durationSec: number,      // inteiro
  zoomTargets: ZoomTarget[],// elementos REAIS, com caixa
  note?: string
}

ZoomTarget {
  nodeId: string
  label: string             // 'Botão "Gerar meu diagnóstico"'
  box: { x, y, w, h }       // espaço de documento, medido pelo crawler
}
```

`SITE_SLOTS` e o tipo `SiteSlot` são **removidos**. As cenas de estúdio não mudam.

Isso quebra o `VideoBrief` que já está na `main` — e tudo bem: o único consumidor é a
própria tela `/videos`, e nenhum vídeo foi produzido ainda. Mudar agora custa uma tarde;
mudar depois de existir projeto salvo custa migração.

## Derivação a partir do Snapshot

Duas funções puras, testáveis sem navegador.

**`sectionsFromSnapshot(snapshot)`** — devolve as seções na ordem da página
(`isSection: true`, ordenadas por `box.y`), com `nodeId`, `sectionId`, `label` e
`screenshot`.

- `sectionId`: o `id` do elemento quando existe; senão um slug do primeiro heading;
  senão `secao-<n>`. Único dentro do snapshot.
- `label`: o texto do primeiro heading da seção quando existe; senão o `sectionId`
  formatado. É o que o humano lê na tela.

**`zoomCandidatesFor(snapshot, sectionNodeId)`** — devolve os elementos de dentro da
seção que valem um zoom, já rotulados:

- Elegíveis: `h1`, `h2`, `h3`, `button`, `form`, `img`, `video`, e `a` com altura ≥ 32px
  (link que é botão, não link de texto corrido).
- Filtros: visível, largura ≥ 40px, altura ≥ 20px, e contido na caixa da seção.
- Rótulo: o texto quando houver (`Botão "Gerar meu diagnóstico"`), senão o tipo
  (`Imagem`, `Vídeo`, `Formulário`).
- **Ordenação e teto:** títulos primeiro, depois botões e links, depois mídia; máximo de
  **8** por seção. Sem teto, `projects` devolve 24 candidatos e a tela vira sopa.

Medido no Snapshot real do milweb: `top` 4 candidatos, `raio-x` 8, `contact` 3,
`projects` 24 (cortado para 8), `section-332` 0 — seção sem candidato simplesmente não
mostra chips.

## Templates viram sugestão

Os 5 templates continuam existindo, mas param de ditar a timeline. `matchTemplate` casa
cada slot desejado com as seções encontradas por heurística de palavra-chave sobre
`sectionId` e `label` (`hero`→`top`/`hero`/`inicio`; `sobre`→`about`/`sobre`/`quem`;
`servicos`→`services`/`servicos`/`deliverables`/`entrego`; e assim por diante).

O resultado traz duas listas: as cenas casadas, e **o que não foi encontrado**. A tela
mostra a segunda como aviso — "o template pede 'Depoimentos' e o site não tem" — em vez
de inventar uma seção que não existe.

As seções encontradas que o template não pediu aparecem desmarcadas na lista, prontas
para você incluir. É assim que a `raio-x` entra num vídeo institucional.

## A tela

A coluna da esquerda ganha um passo antes de tudo:

1. **Captura** — "Escolher a pasta da captura" (ou arrastar o `snapshot.json`). Enquanto
   não houver Snapshot, a lista de cenas mostra só as de estúdio e um aviso explicando
   que cena de site exige captura.
2. Empresa e URL passam a ser **preenchidas a partir do Snapshot** (`url` e o `title` da
   página), editáveis.
3. **Lista de cenas** — cada seção com miniatura, label real, duração e os chips de zoom
   reais. Reordenável, como hoje.
4. Template vira um botão "Aplicar sugestão do template", que marca o que casou e mostra
   o que faltou.

## Consequência nos prompts

**O prompt de gravação perde o sentido para cenas de site** — as imagens já existem. Ele
passa a listar apenas o que **falta** capturar: seções marcadas cuja captura não trouxe
miniatura. Se não faltar nada, a aba mostra "nada a gravar: a captura já cobre todas as
cenas escolhidas".

**O prompt de montagem melhora muito**: passa a citar o arquivo real de cada cena e a
**caixa em pixel** de cada alvo de zoom, em vez de "amplia: Título". É a diferença entre
o Remotion mirar um retângulo e adivinhar.

## Testes

Vitest, funções puras, como o resto do módulo.

- `sections-from-snapshot.test.ts` — ordem por `box.y`; `sectionId` único; fallback de
  label por heading e por id; seção sem heading nem id vira `secao-<n>`.
- `zoom-candidates.test.ts` — só elementos dentro da caixa da seção; filtros de tamanho e
  visibilidade; ordenação título→ação→mídia; teto de 8; seção sem candidato devolve lista
  vazia.
- `match-template.test.ts` — casa por palavra-chave; relata o que não achou; não inventa
  seção inexistente.
- `brief.test.ts` — o novo contrato aceita cena de site com `zoomTargets` com caixa e
  recusa cena de site sem `sectionId`.

**Fixture:** o `snapshot.json` real do milweb.com.br, reduzido, entra como fixture de
teste. É o único jeito de os testes exercitarem markup que não foi escrito para eles.

### Critério de aceite

1. Carregar a captura do milweb na tela lista **13 seções**, com miniatura.
2. A seção `raio-x` pode ser incluída no vídeo — hoje é impossível.
3. Os chips de zoom da `top` mostram o `h1` real e os botões "Falar no WhatsApp" e
   "Ver projetos".
4. O prompt de montagem cita `sections/raio-x.jpg` e a caixa em pixel do botão escolhido.

## Fora de escopo

| Item | Motivo |
| ---- | ------ |
| Rodar o crawler pela tela | Exigiria API e servidor com Chromium — a decisão de custo zero segue de pé |
| Salvar o Snapshot no banco | Upload por sessão resolve; persistir é o passo que justifica banco |
| Detectar mudança do site entre capturas | O fingerprint está gravado desde o dia 1; a UI de diff é outra fatia |
| Editar a caixa de zoom na mão | A caixa vem medida; ajuste fino é v2 |
| Multi-página | O Snapshot é de uma URL; o `VideoBrief` já aceita `snapshotIds[]` |
