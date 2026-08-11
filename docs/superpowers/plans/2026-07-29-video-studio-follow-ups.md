# Video Studio — follow-ups e uma decisão em aberto

Data: 2026-07-29 · Branch: `feat/video-studio-contratos`

Levantado na revisão final da branch (18 commits, 7.230 inserções, 0 deleções).
Tudo aqui é **follow-up**: nada bloqueia o merge — o único bloqueador encontrado
(a rota `/videos` fora do `APP_PREFIXES` do middleware) já foi corrigido no commit
`8ef7070`.

## A decisão em aberto: os aliases de bundler no `next.config.ts`

### O problema

`packages/video-contracts` usa `moduleResolution: NodeNext`, então seus imports
internos terminam em `.js` apontando para arquivos `.ts`. Nem webpack nem Turbopack
resolvem isso sozinhos, e por isso o `apps/web/next.config.ts` ganhou ~45 linhas:
`transpilePackages`, um hook `webpack()` com `resolve.extensionAlias`, e um
`turbopack.resolveAlias` derivado da leitura do diretório do pacote.

**Isso já causou uma quebra real.** Ao derivar a lista, incluir `index.ts` criou um
alias para `./index.js` que sequestrou o import interno do próprio **zod**, derrubando
o bundle do middleware em **todas** as rotas do app. Foi detectado e corrigido durante
o desenvolvimento (`index.ts` agora é excluído explicitamente), mas o mecanismo se
provou perigoso: o `resolveAlias` do Turbopack é **app-wide por especificador exato**.

### O que a varredura mostrou

Busca no store pnpm inteiro (45.078 arquivos, sem limite de profundidade):

- `.ts` sombreando `.js` no mesmo diretório (risco do `extensionAlias`): **1 caso**,
  `pino/test/transport/core.test.ts`, fora do grafo do web.
- Os cinco especificadores restantes (`./annotation.js`, `./brief.js`, `./manifest.js`,
  `./project.js`, `./snapshot.js`): **1 hit**, `vitest/dist/runtime.d.ts` →
  `'./snapshot.js'`. É `.d.ts` de devDependency, não entra no grafo do Next.

**Colisões reais hoje: zero.**

### Por que dá para conviver — e por que não para sempre

O `apps/web` roda `"build": "next build"` (webpack) e `"dev": "next dev --turbopack"`.
Ou seja, **o `resolveAlias` — o mecanismo que matou o middleware — nunca roda no build
de produção**. Hoje é dev-only. Produção passa pelo `extensionAlias`, que é relativo a
caminho e não consegue sequestrar especificador entre pacotes.

Dois prazos, porém:

1. `./snapshot.js`, `./project.js`, `./manifest.js` e `./brief.js` são nomes genéricos.
   Um `pnpm add` qualquer pode reintroduzir a colisão, e a falha é **silenciosa no
   build**, aparecendo só em runtime. Nenhum teste pega isso.
2. **No Next 16, `next build` passa a usar Turbopack por padrão** — e aí o
   `resolveAlias` app-wide entra no caminho de produção. O upgrade do Next vira,
   sozinho, um risco de indisponibilidade.

### Recomendação

**Dar um build de verdade ao pacote de contratos**, antes de o `apps/runner` virar o
segundo consumidor:

- `"build": "tsc -p tsconfig.json"` no `packages/video-contracts` (idêntico ao `apps/api`)
- `main`/`types`/`exports` apontando para `./dist/index.js` e `./dist/index.d.ts`
- `dev.dependsOn: ["^build"]` no `turbo.json` (o `build.dependsOn` já existe), senão
  editar um contrato não reflete no dev do web

Isso **apaga as ~45 linhas inteiras** do `next.config.ts` — `readdirSync`,
`extensionAlias`, `resolveAlias` e o próprio `transpilePackages` — preserva NodeNext e
os sufixos `.js` (convenção da casa: 157 arquivos do `apps/api` usam), e de quebra
torna os sufixos _corretos_, porque o `dist` tem `.js` de verdade.

A alternativa — trocar o pacote para `moduleResolution: "Bundler"` — também funciona e
é mais barata, mas quebra a consistência com os outros 158 arquivos NodeNext do repo e
contraria o texto da spec dos contratos.

## Inconsistências entre os cinco schemas

Nasceram de tasks diferentes; ninguém tinha olhado os cinco lado a lado. Nenhuma
quebra nada hoje, mas todas atrapalham o futuro compilador `VideoBrief + Snapshot →
VideoProject`:

| #   | Inconsistência                                                                                                                         | Por que importa                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `project.ts` discrimina por `type: "site"\|"studio"`; `brief.ts` por `kind`                                                            | O compilador vai traduzir nome de campo à toa                       |
| 2   | `brief.ts` documenta que props explícitas são o ponto, "nunca uma sacola `z.record(z.unknown())`" — e `project.ts` faz exatamente isso | O pacote contradiz a própria doutrina                               |
| 3   | A lista de componentes de estúdio existe em 3 formas: `z.enum` (project), quatro `z.literal` (brief), `z.string().min(1)` (manifest)   | Um 5º componente entra num e não nos outros, sem erro de tipo       |
| 4   | `BriefSceneSchema` é `z.union`; `project.ts` usa `z.discriminatedUnion`                                                                | Quando nenhum ramo casa, o usuário lê `"Invalid input"` cru na tela |

O item 4 tem consequência medida: `buildBrief` mostra `error.issues.map(i => i.message)`,
enquanto os testes afirmam contra `error.message` (o dump JSON do ZodError). São strings
diferentes — os testes podem passar mostrando um texto que o usuário nunca vê.

## Minors que ficaram

Triados na revisão final; nenhum bloqueia merge:

- Mensagens dos validadores built-in do zod ficam em inglês e **vão direto para a tela**
  (`buildBrief` joga `issues` no painel). Numa `/videos` recém-aberta o usuário lê
  `String must contain at least 1 character(s)`. É o de maior visibilidade.
- Duplicação dos 4 campos comuns entre os schemas de cena de estúdio (`.extend()` resolveria).
- Dois testes com `toThrow()` sem regex (só podem lançar por um motivo — inofensivo hoje).
- `ordem` em `scaleDurations` é calculada uma vez e não re-ordenada durante o laço.
- `infoFor` em `build-prompt.ts` reimplementa o que `sceneLabel`/`zoomTargetsFor` fazem
  (tipos de entrada diferentes, então não é duplicação pura).
- Arrasto de cenas só tem `PointerSensor`: sem `KeyboardSensor` nem botões subir/descer,
  não dá para reordenar sem mouse.
- Quatro `brief!` no JSX da página — o `useMemo` devolve união não-discriminada.

## O que conferir depois do deploy

O `next.config.ts` de um app em produção mudou. Dois minutos, nesta ordem:

1. `curl -sI https://millead.milweb.com.br/` **sem cookie** → tem que dar **307** para
   `/login`. Se der 200, o middleware morreu — é o sintoma exato do sequestro do zod.
2. O mesmo em `/leads` e `/dashboard` → 307. Confirma o middleware vivo em todas as rotas.
3. `curl -sI .../videos` sem cookie → **307**. É o teste da regressão que foi corrigida.
4. Logado, abrir `/videos` e testar "Copiar", "Baixar .md" e "Baixar videobrief.json"
   **no navegador que você usa de verdade** — o `revokeObjectURL` fora do Chrome é o
   candidato a falhar.
5. Sanity em `/briefings` e `/proposals` (rotas que usam zod pesado), só para confirmar
   que o `extensionAlias` global não encostou no que já funcionava.

**Riscos do deploy**, em ordem: o `readdirSync` do `next.config.ts` falha com ENOENT se
o projeto na Vercel tiver Root Directory `apps/web` **sem** "Include files outside of the
Root Directory" — build vermelho, deploy não sai (falha segura, não é indisponibilidade).
Mudança no next.config invalida o cache, então o primeiro build depois do merge é do zero.

**Rollback:** a branch é aditiva (0 deleções). Reverter só o commit do `next.config.ts`
desarma tudo, ao custo de a `/videos` parar de compilar.

## Ajuste de conteúdo sugerido pelo aceite

O template **Institucional** termina numa cena de WhatsApp de 2s/5 palavras, e a regra
fixa do prompt manda "termine convidando a acessar o site". Não cabem as duas ideias.
Sugestão do aceite: `notebook 3 · google 5 · hero 6 · sobre 3 · servicos 5 ·
formulario 5 · whatsapp 3` (soma 30s), e considerar uma cena `logo` no fim para carregar
o convite. Detalhes em
[`2026-07-29-video-studio-prompt-mestre-resultado.md`](2026-07-29-video-studio-prompt-mestre-resultado.md).
