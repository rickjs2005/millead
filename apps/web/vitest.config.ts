import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Só as funções puras do diretor criativo por enquanto (sem jsdom, sem React):
 * builders de dossiê e prefill de briefing. É onde a lógica de verdade mora.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
