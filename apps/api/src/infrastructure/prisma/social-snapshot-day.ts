/**
 * Trunca uma data pro início do seu dia em UTC (00:00:00.000Z). Extraída como
 * função pura (sem depender do Prisma, igual audit-query.ts/briefing-where.ts)
 * pra ser testável isoladamente: é o que torna o sync do MilSocial re-rodável
 * no mesmo dia sem duplicar snapshot (o upsert usa este valor como chave
 * `postId_collectedAt` -- ver PrismaSocialRepository.addSnapshot).
 */
export function truncateToUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
