import { describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { ProjectChecklistRepository } from "../../domain/repositories/project-checklist-repository.js";
import {
  INSTITUTIONAL_PHASE_NAMES,
  ProjectChecklistService,
  SYSTEM_PHASE_NAMES,
} from "./project-checklist-service.js";

const ORG = "org-1";

function fakeRepo(overrides: Partial<ProjectChecklistRepository> = {}): ProjectChecklistRepository {
  return {
    create: vi.fn().mockResolvedValue(null),
    findByIdForOrg: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(false),
    updatePhaseStatus: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as ProjectChecklistRepository;
}

describe("ProjectChecklistService", () => {
  it("create semeia exatamente as 16 fases do tipo INSTITUTIONAL", async () => {
    const repo = fakeRepo();
    const service = new ProjectChecklistService(repo);

    await service.create(ORG, { name: "Site X", type: "INSTITUTIONAL" });

    expect(repo.create).toHaveBeenCalledWith(
      { organizationId: ORG, name: "Site X", type: "INSTITUTIONAL" },
      [...INSTITUTIONAL_PHASE_NAMES],
    );
    expect(INSTITUTIONAL_PHASE_NAMES).toHaveLength(16);
  });

  it("create semeia exatamente as 16 fases do tipo SYSTEM", async () => {
    const repo = fakeRepo();
    const service = new ProjectChecklistService(repo);

    await service.create(ORG, { name: "Sistema Y", type: "SYSTEM" });

    expect(repo.create).toHaveBeenCalledWith(
      { organizationId: ORG, name: "Sistema Y", type: "SYSTEM" },
      [...SYSTEM_PHASE_NAMES],
    );
    expect(SYSTEM_PHASE_NAMES).toHaveLength(16);
  });

  it("updatePhaseStatus rejeita NOT_APPLICABLE sem naNote", async () => {
    const repo = fakeRepo();
    const service = new ProjectChecklistService(repo);

    await expect(
      service.updatePhaseStatus(ORG, "checklist-1", 3, { status: "NOT_APPLICABLE" }),
    ).rejects.toThrow(ValidationError);
    expect(repo.updatePhaseStatus).not.toHaveBeenCalled();
  });

  it("updatePhaseStatus aceita NOT_APPLICABLE com naNote", async () => {
    const repo = fakeRepo({
      updatePhaseStatus: vi.fn().mockResolvedValue({
        id: "phase-1",
        projectChecklistId: "checklist-1",
        phaseNumber: 3,
        phaseName: "UX",
        status: "NOT_APPLICABLE",
        naNote: "Sem formulário nesse projeto",
        updatedAt: new Date(),
      }),
    });
    const service = new ProjectChecklistService(repo);

    const phase = await service.updatePhaseStatus(ORG, "checklist-1", 3, {
      status: "NOT_APPLICABLE",
      naNote: "Sem formulário nesse projeto",
    });

    expect(phase.status).toBe("NOT_APPLICABLE");
  });

  it("updatePhaseStatus lança NotFoundError quando a fase não existe/não é da org", async () => {
    const repo = fakeRepo({ updatePhaseStatus: vi.fn().mockResolvedValue(null) });
    const service = new ProjectChecklistService(repo);

    await expect(
      service.updatePhaseStatus(ORG, "checklist-1", 3, { status: "DONE" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("delete lança NotFoundError quando o checklist não existe/não é da org", async () => {
    const repo = fakeRepo({ delete: vi.fn().mockResolvedValue(false) });
    const service = new ProjectChecklistService(repo);

    await expect(service.delete(ORG, "checklist-x")).rejects.toThrow(NotFoundError);
  });

  it("get lança NotFoundError quando o checklist não existe/não é da org", async () => {
    const repo = fakeRepo({ findByIdForOrg: vi.fn().mockResolvedValue(null) });
    const service = new ProjectChecklistService(repo);

    await expect(service.get(ORG, "checklist-x")).rejects.toThrow(NotFoundError);
  });
});
