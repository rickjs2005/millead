# Resultado — Inspector: as cenas passam a vir do site

Data: 2026-07-29 · Branch: `feat/video-studio-inspector`

Alvo: **milweb.com.br**, capturado pelo crawler e carregado na tela `/videos`.

## Critério de aceite da spec

| # | Critério | Status |
| - | -------- | ------ |
| 1 | Carregar a captura lista as seções reais, com miniatura | ✅ **13 seções**, todas com miniatura |
| 2 | A seção `raio-x` pode entrar no vídeo | ✅ era impossível antes |
| 3 | Os chips da `top` mostram o `h1` real e os dois botões | ✅ |
| 4 | O prompt de montagem cita o arquivo e a caixa em pixel | ✅ |

### 1 — as 13 seções, com miniatura e alvos

```
top            sections/top.jpg             4 alvos
deliverables   sections/deliverables.jpg    7 alvos
why            sections/why.jpg             8 alvos
secao-3        sections/section-332.jpg     0 alvos
raio-x         sections/raio-x.jpg          8 alvos
google         sections/google.jpg          8 alvos
projects       sections/projects.jpg        8 alvos
lab            sections/lab.jpg             7 alvos
process        sections/process.jpg         5 alvos
tech           sections/tech.jpg            1 alvo
faq            sections/faq.jpg             1 alvo
about          sections/about.jpg           1 alvo
contact        sections/contact.jpg         3 alvos
```

A `secao-3` é a única sem `id` no HTML e sem heading — recebeu id derivado do índice e
zero candidatos de zoom. É o comportamento correto para uma seção sem nada a ampliar.

### 2 — a `raio-x`

```
ACHADA: "Depender só de rede social custa caro" -> sections/raio-x.jpg
```

Esta era a prova da fatia: a seção mais característica do site, que o catálogo fixo de
8 tipos não conseguia representar de jeito nenhum.

### 3 — alvos reais do hero

```
Título "Seu site pode ser o melhor vendedor da …"
Link "Ver projetos"
Link "Falar no WhatsApp"
Imagem
```

Contra o que estava no ar antes: *"Título", "Botão principal", "Imagem de fundo"*.

### 4 — o prompt de montagem

```
sc-raiox · SiteScene · imagem: "sections/raio-x.jpg"
  · amplia: Botão "Gerar meu diagnóstico gratuito" em { x: 993, y: 4216, w: 587, h: 48 }
```

Arquivo real, elemento real, caixa em pixel inteiro. É a diferença entre o Remotion
mirar um retângulo e adivinhar.

**Template Institucional contra este site:** casou 4 cenas de site, `naoEncontrados`
vazio. O Portfólio, testado na tela, casou 4 de 5 e avisou *"O site não tem o que o
template pede para: Depoimentos"* — que é verdade.

## Os defeitos que os dados reais revelaram

Três, e nenhum apareceria com dado inventado.

**1. Casamento por prosa roubava seção.** Eu especifiquei "procure a palavra no
`sectionId` **ou** no `label`", como se fossem equivalentes. Não são: o título da seção
`contact` é *"Pronto para transformar sua ideia em um produto digital?"*, então um
pedido de "Produtos" abocanhava a seção de contato pela palavra "produto", e "Contato"
era reportado como não encontrado **com a seção existindo**. Corrigido com duas
passadas: id primeiro, prosa depois.

**2. A fixture ficou reduzida demais.** Cortei o snapshot real para 4 seções e deixei
dois caminhos sem nenhum dado que os exercitasse — o teto de 8 candidatos nunca cortava,
e "seção sem id mas com heading" não existia. Cobertos com snapshots sintéticos, sem
tocar na fixture real.

**3. `idUnico` não garantia unicidade.** Uma tentativa só; se o nome sufixado já
estivesse em uso, devolvia duplicado. Provado com um caso construído: a versão antiga dá
`['x-2','x','x-2']`, a nova dá `['x-2','x','x-3']`.

## O que este resultado não prova

- **A verificação da tela não foi feita com o seletor de pasta nativo.** A automação de
  navegador não aciona esse diálogo do sistema. O implementador injetou a lista de
  arquivos com os caminhos corretos e disparou o evento real do input — exercita o
  código de produção, mas não é idêntico a um clique humano. Vale fazer uma vez à mão.
- **Só um site foi usado, e é nosso.** Continua pendente desde o crawler: rodar contra
  markup que ninguém aqui escreveu.
- **Nenhum vídeo foi produzido.** Falta o compilador `VideoBrief + Snapshot →
  VideoProject` e a montagem no Remotion.

## Pendências registradas

- Pasta com mais de uma captura dentro carrega a primeira que o navegador entregar, sem
  avisar qual.
- `buildCapturePrompt` não distingue "timeline sem cena de site" de "toda cena já
  capturada".
- Não há como remover uma cena da timeline além de desmarcá-la.
