# AI Creative Director — design

> Substitui o gerador de prompt de site (`apps/web/src/features/prompt-builder`) por um
> diretor criativo: análise estratégica, conceito, storytelling, direção de arte,
> produção de vídeo (Higgsfield/Veo/Runway), imagens e arquitetura front-end premium.
>
> Data: 2026-07-25 · Status: implementado
>
> Verificação: `tsc --noEmit` (web e api), `eslint`, `prettier --check`, `next build`
> e `vitest` (25 testes) — todos passando.

## Problema

O gerador atual compõe um prompt determinístico a partir de escolhas de estilo,
framework, animação e seções. Ele não produz direção criativa: nenhum conceito,
nenhuma narrativa, nenhuma referência específica ao negócio, nenhuma integração
entre vídeo e experiência de navegação. O resultado tende ao template.

Conceito único, storytelling, metáforas, moodboard e lista de cenas **não podem**
sair de um template determinístico — um template só instrui a IA de destino a
pensar, ele não pensa. Daí a arquitetura híbrida abaixo.

## Decisões

| Questão                          | Decisão                                                                                                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Onde mora o cérebro criativo     | **Híbrido**: dossiê determinístico grátis + botão opcional que chama Claude no backend                 |
| Formato da saída                 | **5 abas por destino**, cada uma com copiar próprio + baixar tudo (.md)                                |
| Coleta dos ~20 pontos de análise | **8 controles de alto sinal** no formulário; os outros ~12 viram instruções de análise que a IA infere |
| Persistência                     | **Efêmero** — sem tabela, sem migration, sem fila                                                      |

## Arquitetura

```
FORMULÁRIO (CreativeInput)
   │
   ├──────────────► buildDossier(input, null)          MODO GRÁTIS (client-side)
   │
   └── [Direção criativa com IA]  (opcional)
            POST /api/v1/ai/creative-direction  → Claude Opus 5
                      ↓ CreativeDirection (JSON validado)
            buildDossier(input, direction)              MODO RICO
                      │
        ┌─────────────┼─────────────┬──────────┬────────────┐
     Dossiê        Código         Vídeo     Imagens    Checklists
```

`buildDossier` é a mesma função nos dois modos. Sem direção, os blocos que exigem
invenção viram **instruções**; com direção, viram **conteúdo**. O esqueleto nunca muda.

### Web — `apps/web/src/features/creative-director/`

| Arquivo                      | Responsabilidade                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                   | `CreativeInput`, `CreativeDirection`, `Dossier`, `VideoScene`                                                                   |
| `options.ts`                 | catálogos: estilos, stack, animações, efeitos, seções, objetivos, emoções, arquétipos, câmera, luz, planos, escalas dos sliders |
| `context.ts`                 | blocos de markdown compartilhados (negócio, posicionamento, stack, direção materializada)                                       |
| `analysis-brief.ts`          | o bloco "analise e escreva" com os 12 pontos inferidos                                                                          |
| `to-brief.ts`                | traduz o formulário no payload da IA (rótulos e níveis por extenso)                                                             |
| `hooks.ts`                   | `useCreativeDirection` (mutation)                                                                                               |
| `artifacts/concept.ts`       | aba Dossiê                                                                                                                      |
| `artifacts/code-prompt.ts`   | aba Código (o prompt do Claude Code)                                                                                            |
| `artifacts/video-prompts.ts` | aba Vídeo (cenas × Higgsfield/Veo/Runway)                                                                                       |
| `artifacts/image-prompts.ts` | aba Imagens (Midjourney/Flux/Leonardo)                                                                                          |
| `artifacts/checklists.ts`    | aba Checklists                                                                                                                  |
| `build-dossier.ts`           | orquestra os 5 + monta o `.md` completo                                                                                         |
| `briefing-prefill.ts`        | migrado do prompt-builder, lógica inalterada                                                                                    |

Todos os artefatos são funções puras `(ctx: DossierContext) => string`.

### API

```
domain/services/creative-director.ts            porta + tipos
infrastructure/ai/claude-creative-director.ts   adapter Claude
application/dto/creative-direction.dto.ts       zod do request
POST /api/v1/ai/creative-direction              aiRateLimit + leads:read
```

A rota entrou sob `/api/v1/ai` (e não em `/api/v1/creative-direction`, como no rascunho
inicial): é um recurso de IA, reusa `ai-routes`/`ai-controller`/`AiService` e o mesmo
`GET /api/v1/ai/status` que a UI já consulta.

Stateless. Sem chave → **503** (`AiNotConfiguredError`, já existente). O front usa
`GET /api/v1/ai/status` (já existente) para desabilitar o botão antes do clique.

## Contrato `CreativeDirection`

```ts
{
  analise:      { posicionamento, tomDeVoz, dispositivoDominante, nivelSeo, objecoes: string[] }
  conceito:     { nome, ideiaCentral, metafora, emocaoAlvo, porqueFunciona }
  narrativa:    { ato1, ato2, ato3, fioCondutor }
  direcaoDeArte:{ paleta: [{hex, papel}], tipografia: {display, texto, porque}, texturas, grid, luz }
  moodboard:    [{ categoria, referencia, oQueExtrair }]
  wireframe:    [{ secao, objetivo, objecaoQueResponde, conteudo, animacao, temVideo }]
  cenas:        [{ ordem, secaoDoSite, descricao, movimentoDeCamera, plano, iluminacao,
                   paletaCinematografica, duracaoSeg, integracaoComScroll,
                   primeiroFrame, ultimoFrame }]
  stills:       [{ uso, descricao, camera, lente, luz, composicao }]
  copy:         { headline, subheadline, ctaPrincipal, ctasSecundarios }
  extras:       string[]
}
```

**Integração vídeo ↔ site** — três campos fazem o vídeo deixar de ser elemento separado:

- `secaoDoSite` amarra a cena a uma seção do wireframe;
- `integracaoComScroll` descreve o comportamento (scroll-sync, mouse-sync, loop, reveal);
- `primeiroFrame`/`ultimoFrame` descrevem os frames de borda, permitindo que a cena
  seguinte comece onde a anterior parou e que a câmera continue.

## Modelo e parâmetros

- `claude-opus-5` (default de `AI_MODEL`; continua configurável por env)
- adaptive thinking (padrão no Opus 5) + `output_config.effort: "high"`
- **streaming** com `.finalMessage()` — `max_tokens` alto sem stream estoura timeout HTTP
- **structured outputs** (`output_config.format` + json_schema) — JSON inválido impossível
- tratar `stop_reason: "refusal"` antes de ler `content`

## Erros

| Situação                | Comportamento                                       |
| ----------------------- | --------------------------------------------------- |
| Sem `ANTHROPIC_API_KEY` | botão desabilitado com tooltip; modo grátis intacto |
| Timeout / rede          | toast; dossiê grátis permanece na tela              |
| Recusa do modelo        | mensagem específica                                 |
| Rate limit              | `aiRateLimit`, igual aos demais endpoints de IA     |

## Testes

O repositório não tinha runner de teste. Foi adicionado **vitest** em `apps/web`
(`vitest.config.ts`: `environment: "node"`, alias `@ → ./src`, `include: src/**/*.test.ts`)
e o script `test` no `package.json`, que o `turbo run test` já sabia chamar.

Cobertura: as **funções puras**. É onde mora a lógica de verdade — o resto da tela é
composição de componentes já existentes.

```
pnpm --filter @millead/web test        # 25 testes, 3 arquivos
```

| Arquivo                        | Casos | O que protege                                              |
| ------------------------------ | ----: | ---------------------------------------------------------- |
| `build-dossier.test.ts`        |    12 | os dois modos, os 3 formatos de vídeo, o `.md` completo    |
| `briefing-prefill.test.ts`     |     6 | a heurística por substring, que não tinha rede de proteção |
| `artifacts/checklists.test.ts` |     7 | os itens condicionais derivados das escolhas               |

### `build-dossier.test.ts`

**Modo grátis** — o dossiê instrui em vez de inventar:

- os blocos aparecem marcados como `(a produzir)` e o prompt de código abre com a `Etapa 0`
- os dados do negócio chegam ao dossiê e ao prompt de código
- a aba de vídeo fica habilitada, **sem cenas**, entregando o briefing de produção
  (garante que nenhuma cena genérica seja inventada por template)
- as proibições visuais e de copy estão no prompt de código

**Modo rico** — a direção da IA substitui as instruções:

- conceito, fio condutor e moodboard aparecem materializados e `(a produzir)` **some**
- o wireframe e a copy âncora entram no prompt de código, e a `Etapa 0` **some**
- cada cena gera os três prompts com os frames de borda
  (`Camera motion:` no Runway, `End frame: …`, `som ambiente` no Veo)
- os stills saem nos dois formatos (`--ar` no Midjourney, prosa no Flux/Leonardo)
- `full` contém os cinco artefatos

**Vídeo desligado** (`videoWeight: 0`) — aba desabilitada, zero cenas, o prompt de código
diz "não usa vídeo" e a palavra `Higgsfield` não aparece no `.md` completo, mesmo com
direção criativa contendo cenas. Esse é o teste que impede o slider de virar decorativo.

**`dossierFileName`** — slug com acentos normalizados (`padaria-sao-jorge`) e fallback
para `projeto` quando não há nome.

### `briefing-prefill.test.ts`

Fixture mínima construída à mão (o prefill só lê `template.sections[].fields` e `answers`):

- keys canônicas do seed → `businessName`, `description`, `audience`, `differentials`
- cidade + estado viram `location`; WhatsApp/telefone/e-mail viram uma linha de `contact`
- os campos novos são capturados: `competitors`, `averageTicket`, `segment`
- campo `FILE` é descartado e **todo o resto vai pras observações** — o teste verifica as
  duas metades: o horário aparece em `notes`, a URL do blob não
- resposta em array (checkbox) vira lista, e valor repetido de grupo é deduplicado
- resposta cujo `fieldId` não existe mais no template é ignorada sem quebrar

### `artifacts/checklists.test.ts`

Cada item condicional é testado nos **dois sentidos** — presente quando a escolha existe,
ausente quando não:

- as seis listas sempre saem
- Three.js/shader → exige fallback sem WebGL
- vídeo → itens de first paint e conexão lenta
- objetivo → WhatsApp pede mensagem pré-preenchida, agendamento pede calendário direto
- arquivo único → **não** pede sitemap.xml
- localização preenchida → pede `LocalBusiness` no JSON-LD
- cursor customizado → exige desativação no toque

### Deliberadamente fora

- **Componentes React da tela**: exigiriam jsdom e testing-library para cobrir composição
  de componentes que já existem e já são usados em outras telas.
- **O adapter Claude**: testá-lo significaria mockar o SDK e assertar o próprio prompt —
  um teste que quebra a cada ajuste de texto sem pegar defeito real. O contrato de saída
  já é garantido pelo structured output no lado da API.
- **O conteúdo dos prompts**: os testes checam presença de âncoras estruturais
  (cabeçalhos, campos, proibições), não a redação — que deve poder evoluir livremente.

## Fora de escopo

- Persistência/histórico de dossiês (decisão explícita: efêmero)
- Remoção do módulo dormente de landing pages por IA na API
- Rota nova: continua em `/landing-pages`; muda só o rótulo do menu
