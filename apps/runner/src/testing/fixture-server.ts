import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/** Servidor estático em porta livre, só para os testes de integração. */
export async function startFixtureServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const requested = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"));
    const filePath = join(FIXTURES_DIR, requested === "/" ? "home.html" : requested);
    if (!filePath.startsWith(FIXTURES_DIR)) {
      res.writeHead(403).end();
      return;
    }
    stat(filePath)
      .then(() => {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        createReadStream(filePath).pipe(res);
      })
      .catch(() => res.writeHead(404).end());
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("servidor não subiu");

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
