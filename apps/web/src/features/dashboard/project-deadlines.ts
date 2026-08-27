import type { ProjectChecklistSummary } from "@/types/api";

export interface ProjectDeadline {
  project: ProjectChecklistSummary;
  /** Dias até o prazo. Negativo = atrasado. */
  daysLeft: number;
  overdue: boolean;
}

/**
 * `dueAt` é DATE-ONLY (a automação grava meia-noite UTC a partir de
 * `assinadoEm + prazoEntregaDias`). Comparar com `Date.now()` cru faria um
 * projeto que vence hoje aparecer como atrasado desde as 00:00 UTC — 21h de
 * Brasília do dia anterior. Os dois lados são normalizados pro dia UTC antes
 * de subtrair, então "vence hoje" é 0 o dia inteiro.
 */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Projetos que vencem dentro de `withinDays` ou que já passaram do prazo,
 * do mais urgente pro menos. Função pura: o endpoint de checklists devolve a
 * lista inteira sem paginação, então filtrar aqui evita um endpoint novo — e
 * deixa a regra testável sem banco.
 *
 * Projeto sem `dueAt` (criado à mão, sem contrato) fica de fora: não há prazo
 * pra cobrar. Projeto 100% concluído também — o prazo deixou de importar.
 */
export function selectProjectDeadlines(
  projects: readonly ProjectChecklistSummary[],
  now: Date,
  withinDays = 14,
): ProjectDeadline[] {
  const today = utcDay(now);

  return projects
    .filter((p) => p.dueAt !== null && p.progressPercent < 100)
    .map((p) => {
      const daysLeft = Math.round((utcDay(new Date(p.dueAt!)) - today) / DAY_MS);
      return { project: p, daysLeft, overdue: daysLeft < 0 };
    })
    .filter((d) => d.daysLeft <= withinDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** "Venceu há 3 dias" / "Vence hoje" / "Faltam 5 dias". */
export function deadlineLabel(daysLeft: number): string {
  if (daysLeft < 0) {
    const dias = Math.abs(daysLeft);
    return `Venceu há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  }
  if (daysLeft === 0) return "Vence hoje";
  if (daysLeft === 1) return "Vence amanhã";
  return `Faltam ${daysLeft} dias`;
}
