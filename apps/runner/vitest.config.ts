import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // A captura sobe Chromium: 60s por teste é folgado e evita falso negativo
    // em máquina fria.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
