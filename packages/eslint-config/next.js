import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";
import base from "./base.js";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...base,
  ...compat.extends("next/core-web-vitals"),
  // `next/core-web-vitals` reafirma o PRÓPRIO parser TS por cima do nosso
  // (vem depois, ganha) -- e ele fica numa versão presa à do
  // eslint-config-next, descasada da versão do @typescript-eslint/*
  // que o resto do monorepo usa. Esse descompasso de versão faz o
  // `no-unused-vars` achar `import type { X }` "nunca usado" mesmo
  // quando X está numa anotação de tipo. Reimpõe nosso parser (e a regra)
  // por último pra voltar a detectar certo.
  {
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];
