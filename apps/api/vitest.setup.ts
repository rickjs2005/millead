// `config/env.ts` valida com zod no import (falha rápido no boot real). Os
// testes daqui são só lógica pura -- não tocam banco/blob de verdade -- mas
// qualquer módulo que importe `config/env.js` no runtime (ex.:
// proposal-service.ts, que monta a publicUrl com WEB_PUBLIC_URL) dispara
// essa validação mesmo assim. Sem isso, rodar `vitest` num shell sem as
// env vars reais exportadas (CI, ou qualquer sessão sem o `.env` da raiz
// carregado) quebra com ZodError antes de qualquer teste rodar. Preenche só
// o mínimo exigido pelo schema, e só se ainda não estiver setado -- um
// `.env` real ou env vars de CI continuam tendo prioridade.
const REQUIRED_DEFAULTS: Record<string, string> = {
  DATABASE_URL: "postgresql://test:test@localhost:5432/test?schema=public",
  JWT_ACCESS_SECRET: "test-only-secret-0123456789012345678901234567890",
  BLOB_READ_WRITE_TOKEN: "test-only-blob-token",
  // Cofre Financeiro: sem isto o módulo nasce fechado (é o comportamento
  // correto em produção), e os testes da sessão elevada não teriam o que
  // exercitar. Diferente do segredo do access token de propósito -- o schema
  // de env recusa os dois iguais em produção.
  VAULT_SESSION_SECRET: "test-only-vault-secret-98765432109876543210987",
};

for (const [key, value] of Object.entries(REQUIRED_DEFAULTS)) {
  if (!process.env[key]) process.env[key] = value;
}
