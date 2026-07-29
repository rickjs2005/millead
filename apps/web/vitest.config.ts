import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * As funções puras do diretor criativo (builders de dossiê e prefill de
 * briefing) e do video-studio (build-brief, build-prompt, templates) --
 * sem jsdom, sem React. É onde a lógica de verdade mora.
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
