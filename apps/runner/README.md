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

A guarda também só examina a URL crua, antes do `page.goto`: um
redirecionamento do site para um alvo interno não é detectado (ver comentário
em `src/cli.ts`).

## Testes

```bash
pnpm --filter @millead/runner test
```

Rodam offline, contra um servidor de fixtures em `src/testing/fixtures/`.
**milweb.com.br não entra no CI** — site muda, rede falha, e teste intermitente
é pior que teste nenhum.
