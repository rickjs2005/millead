/**
 * Identidade do código em execução. Existe porque web e API deployam em
 * lugares diferentes (Vercel x Render): sem isso, "o front já subiu e a API
 * não" vira adivinhação na hora de conferir um comportamento novo.
 */

/** SHA curto do commit em execução, ou "dev" fora de um deploy. */
export function resolveCommit(env: Record<string, string | undefined>): string {
  // O Render injeta RENDER_GIT_COMMIT sozinho; GIT_COMMIT cobre outros ambientes.
  const sha = firstFilled(env.RENDER_GIT_COMMIT, env.GIT_COMMIT);
  return sha ? sha.slice(0, 7) : "dev";
}

function firstFilled(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/** Momento em que o processo subiu -- denuncia restart e cold start do Render. */
export const startedAt = new Date().toISOString();
