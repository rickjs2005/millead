import { describe, expect, it } from "vitest";
import {
  artifactHref,
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_STEP_LABELS,
  AUTOMATION_STEP_STATUS_LABELS,
  canReprocess,
} from "./labels";
import type {
  AutomationExecutionStatus,
  AutomationStepKey,
  AutomationStepStatus,
} from "@/types/api";

describe("artifactHref", () => {
  it("cada tipo de artefato aponta pra rota que existe no app", () => {
    expect(artifactHref("LEAD", "lead-1", "contract-1")).toBe("/leads/lead-1");
    expect(artifactHref("BRIEFING", "b-1", "contract-1")).toBe("/briefings/b-1");
    expect(artifactHref("PROJECT_CHECKLIST", "p-1", "contract-1")).toBe("/projetos/p-1");
    expect(artifactHref("TASK", "t-1", "contract-1")).toBe("/tasks");
  });

  it("plano de recebimento volta pro contrato -- nao existe rota de parcela", () => {
    expect(artifactHref("RECEIVABLE_PLAN", "contract-1", "contract-1")).toBe(
      "/contracts/contract-1",
    );
  });
});

describe("canReprocess", () => {
  it("so oferece reprocessar em estado terminal com pendencia ou falha", () => {
    expect(canReprocess("PENDING")).toBe(true);
    expect(canReprocess("PARTIAL")).toBe(true);
    expect(canReprocess("FAILED")).toBe(true);
  });

  it("nao oferece reprocessar durante a execucao nem depois do sucesso", () => {
    // Reprocessar RUNNING geraria um job concorrente que o CAS da API
    // recusaria; SUCCEEDED a API recusa com 422. Esconder o botão evita os
    // dois erros previsíveis.
    expect(canReprocess("RUNNING")).toBe(false);
    expect(canReprocess("SUCCEEDED")).toBe(false);
  });
});

describe("mapas de rotulo", () => {
  it("toda etapa da API tem rotulo (senao a tela mostraria vazio)", () => {
    const keys: AutomationStepKey[] = [
      "LEAD_WON",
      "RECEIVABLES",
      "BRIEFING",
      "PROJECT",
      "TASKS",
    ];
    for (const key of keys) expect(AUTOMATION_STEP_LABELS[key]).toBeTruthy();
  });

  it("todo status de execucao e de etapa tem rotulo", () => {
    const execution: AutomationExecutionStatus[] = [
      "PENDING",
      "RUNNING",
      "SUCCEEDED",
      "PARTIAL",
      "FAILED",
    ];
    for (const status of execution) expect(AUTOMATION_STATUS_LABELS[status]).toBeTruthy();

    const step: AutomationStepStatus[] = [
      "PENDING",
      "RUNNING",
      "SUCCEEDED",
      "SKIPPED",
      "NEEDS_ACTION",
      "FAILED",
    ];
    for (const status of step) expect(AUTOMATION_STEP_STATUS_LABELS[status]).toBeTruthy();
  });
});
