import { describe, expect, it } from "vitest";
import { deadlineLabel, selectProjectDeadlines } from "./project-deadlines";
import type { ProjectChecklistSummary } from "@/types/api";

function project(overrides: Partial<ProjectChecklistSummary> = {}): ProjectChecklistSummary {
  return {
    id: "p1",
    organizationId: "org-1",
    name: "Cliente LTDA — MILWEB-2026-000001",
    type: "INSTITUTIONAL",
    companyId: "c1",
    leadId: null,
    contractId: "contract-1",
    localFolder: null,
    startedAt: "2026-08-26T00:00:00.000Z",
    dueAt: "2026-09-25T00:00:00.000Z",
    progressPercent: 20,
    createdAt: "2026-08-26T00:00:00.000Z",
    updatedAt: "2026-08-26T00:00:00.000Z",
    ...overrides,
  };
}

// Meio do dia de Brasília = 15:00Z. É o horário que mais provavelmente
// revelaria um erro de fuso na comparação de datas date-only.
const NOW = new Date("2026-09-20T15:00:00Z");

describe("selectProjectDeadlines", () => {
  it("projeto sem prazo fica de fora -- não há o que cobrar", () => {
    expect(selectProjectDeadlines([project({ dueAt: null })], NOW)).toEqual([]);
  });

  it("projeto 100% concluído fica de fora mesmo atrasado", () => {
    const done = project({ dueAt: "2026-09-01T00:00:00.000Z", progressPercent: 100 });
    expect(selectProjectDeadlines([done], NOW)).toEqual([]);
  });

  it("projeto fora da janela de 14 dias fica de fora", () => {
    const distante = project({ dueAt: "2026-12-01T00:00:00.000Z" });
    expect(selectProjectDeadlines([distante], NOW)).toEqual([]);
  });

  it("calcula dias restantes ignorando a hora (dueAt é date-only)", () => {
    const [d] = selectProjectDeadlines([project({ dueAt: "2026-09-25T00:00:00.000Z" })], NOW);
    expect(d!.daysLeft).toBe(5);
    expect(d!.overdue).toBe(false);
  });

  it("vencendo HOJE é 0 e não conta como atrasado", () => {
    // O caso que um `Date.now()` cru quebraria: dueAt é meia-noite UTC, que
    // já passou às 15:00Z do mesmo dia.
    const [d] = selectProjectDeadlines([project({ dueAt: "2026-09-20T00:00:00.000Z" })], NOW);
    expect(d!.daysLeft).toBe(0);
    expect(d!.overdue).toBe(false);
  });

  it("prazo passado vira dias negativos e overdue", () => {
    const [d] = selectProjectDeadlines([project({ dueAt: "2026-09-17T00:00:00.000Z" })], NOW);
    expect(d!.daysLeft).toBe(-3);
    expect(d!.overdue).toBe(true);
  });

  it("ordena do mais urgente pro menos", () => {
    const items = selectProjectDeadlines(
      [
        project({ id: "a", dueAt: "2026-09-25T00:00:00.000Z" }),
        project({ id: "b", dueAt: "2026-09-15T00:00:00.000Z" }),
        project({ id: "c", dueAt: "2026-09-21T00:00:00.000Z" }),
      ],
      NOW,
    );
    expect(items.map((d) => d.project.id)).toEqual(["b", "c", "a"]);
  });
});

describe("deadlineLabel", () => {
  it("usa singular e plural corretamente", () => {
    expect(deadlineLabel(-1)).toBe("Venceu há 1 dia");
    expect(deadlineLabel(-3)).toBe("Venceu há 3 dias");
    expect(deadlineLabel(0)).toBe("Vence hoje");
    expect(deadlineLabel(1)).toBe("Vence amanhã");
    expect(deadlineLabel(5)).toBe("Faltam 5 dias");
  });
});
