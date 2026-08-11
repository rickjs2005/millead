# Resultado — crawler do Video Studio

Data: 2026-07-29 · Branch: `feat/video-studio-crawler`

Alvo: **milweb.com.br**, viewport 1920×1080.

## Critério de aceite da spec

| #   | Critério                                         | Status | Evidência                                     |
| --- | ------------------------------------------------ | ------ | --------------------------------------------- |
| 1   | Pacote valida no zod                             | ✅     | `snapshot.json` aceito, `warnings: []`        |
| 2   | Seções da home identificadas                     | ✅     | **13 seções**, com os ids reais do site       |
| 3   | Caixas conferem com os tiles a olho nu           | ✅     | coordenadas contíguas, conferidas nas imagens |
| 4   | Duas execuções diferem só em `id` e `capturedAt` | ✅     | 1276 nós e 13 seções nas duas capturas        |

**Números da captura:** 1276 nós · 13 seções · 14 tiles · página de 14.458px.

**Seções encontradas, na ordem da página:** `top`, `deliverables`, `why`, `section-332`,
`raio-x`, `google`, `projects`, `lab`, `process`, `tech`, `faq`, `about`, `contact`.

As coordenadas saem contíguas — cada seção começa exatamente onde a anterior termina
(`top` em y=57 h=995 · `deliverables` em y=1052 h=953 · `why` em y=2004 h=770 …), o que
é a assinatura de caixa medida corretamente em espaço de documento.

## Os dois defeitos que só apareceram no site real

Ambos passaram pelos 55 testes da suíte, `type-check` e `lint` sem acusar nada.

### 1. `__name is not defined` — o CLI quebrava, os testes não

Primeira execução: `page.evaluate: ReferenceError: __name is not defined`.

**Causa:** o `tsx` (esbuild) compila função nomeada como `__name(function f(){}, "f")`
para preservar o nome. O Playwright serializa o callback do `page.evaluate` com
`toString()` e injeta o texto na página, onde esse helper não existe. O `extract.ts`
tem duas funções nomeadas ali dentro (`cssSelector` e `walk`).

**Por que nenhum teste pegou:** a suíte roda sob **Vitest**, que transforma o código de
outro jeito. Só o **tsx** injeta o helper. A suíte inteira exercitava um caminho
diferente do que o usuário executa.

**Correção:** shim de `__name` no `globalThis` dentro do callback. Atenção — a forma
óbvia (`const __name = (fn) => fn`) **não funciona**: o esbuild detecta a colisão de
nome e renomeia a constante local para `__name2`, deixando as chamadas órfãs. Só
funciona escrevendo uma propriedade (`globalThis.__name ??= …`), que sobrevive ao
renomeador.

**Guarda contra regressão:** `cli-subprocess.test.ts` roda o CLI como **subprocesso via
tsx** — o caminho real do usuário — em vez de importar a função.

### 2. Barra de navegação assada no meio das miniaturas

Com a captura funcionando, as imagens revelaram o segundo defeito: em toda seção mais
alta que a tela, a barra fixa do site aparecia **no meio da miniatura**, atravessando o
conteúdo. Em `sections/projects.jpg` ela cortava os cards da Kavita ao meio.

**Causa:** `locator.screenshot()` de elemento mais alto que o viewport rola e costura
várias capturas; elemento `fixed`/`sticky` fica grudado na tela e é assado em cada
emenda. É primo do problema que já tínhamos evitado nos tiles ao recusar `fullPage`.

**Os tiles estavam corretos** — neles a barra aparece no topo, que é onde ela realmente
está.

**Correção, na terceira tentativa.** As duas primeiras quebraram o hero:

1. `position: static !important` em `*` — empurrou o texto do hero de ~9% para ~57% da
   altura.
2. Neutralizar `position` só de `fixed`/`sticky` — **também** quebrou: trocar a
   `position` do `<header>` sticky reiniciava a animação de entrada do hero pela metade,
   por algum observer da página. Isolado empiricamente, causa não identificada (é código
   de produção do site, fora deste repo).
3. ✅ Marcar `fixed`/`sticky` por `getComputedStyle` e aplicar **`visibility: hidden`** —
   não toca em fluxo nem layout, e não dispara a regressão da animação.

> Se um dia trocarem essa técnica, **testem contra a seção `top` antes de confiar**.

## Verificação visual

Regra da casa: nenhum "funcionou" sem alguém ter aberto as imagens.

| Imagem                                    | O que se vê                                                                                                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sections/top.jpg`                        | Hero inteiro: eyebrow, "Seu site pode ser o melhor **vendedor** da sua empresa.", os quatro bullets, a assinatura do Rick e os dois botões. Sem ghosting. |
| `sections/projects.jpg`                   | "Projetos & produtos" com os dois cards da Kavita íntegros e o carrossel de projetos autorais (RJjstore, Milsaca, MilLead). **Sem barra no meio.**        |
| `sections/raio-x.jpg`                     | Calculadora, cartões de estatística, gauge de risco, barras e donut no lugar.                                                                             |
| `tiles/000-y0.jpg`, `tiles/006-y6480.jpg` | Barra de navegação no **topo** — correto. Lula e robô nítidos.                                                                                            |

## O que este resultado NÃO prova

- **Só um site foi capturado, e é nosso.** A spec pede explicitamente rodar contra um
  site que ninguém aqui escreveu, para medir o quanto o crawler depende de markup
  familiar. Isso **não foi feito** e continua pendente.
- **Nenhuma caixa de zoom foi validada contra elemento nomeado.** As seções saíram
  certas; casar "botão principal" com o elemento real é trabalho do compilador
  `VideoBrief + Snapshot → VideoProject`, que ainda não existe.
- **Nenhum vídeo foi produzido.** Este é o material bruto.

## Pendências herdadas

- A guarda de URL não cobre **redirecionamento depois do `goto`** nem **DNS rebinding** —
  documentado em comentário no `cli.ts` e no README, não mitigado.
- `captures/<id>.anterior` pode vazar se o processo morrer no meio da promoção; o CLI
  varre órfãos na entrada, o que cobre o caso na prática.
