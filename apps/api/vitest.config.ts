import { defineConfig } from "vitest/config";

// Só lógica pura (sem banco, sem HTTP) -- arquivos `*.test.ts` dentro de src.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
