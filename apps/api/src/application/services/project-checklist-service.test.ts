import { describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { ProjectChecklistRepository } from "../../domain/repositories/project-checklist-repository.js";
import {
  computeProgressPercent,
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

function fakeCompanyRepo(overrides: Partial<CompanyRepository> = {}): CompanyRepository {
  return {
    create: vi.fn(),
    findByIdForOrg: vi.fn().mockResolvedValue(null),
    findByDocumentForOrg: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addWebsite: vi.fn(),
    removeWebsite: vi.fn(),
    addSocial: vi.fn(),
    removeSocial: vi.fn(),
    ...overrides,
  } as unknown as CompanyRepository;
}

/** Lead/Contract só existem no service pra impedir vínculo cruzando tenant
 *  (a automação pós-fechamento é quem passa esses ids). O default devolve
 *  null = "não é desta organização", que é o caso seguro. */
function fakeLeadRepo(overrides: Partial<LeadRepository> = {}): LeadRepository {
  return { findByIdForOrg: vi.fn().mockResolvedValue(null), ...overrides } as unknown as LeadRepository;
}

function fakeContractRepo(overrides: Partial<ContractRepository> = {}): ContractRepository {
  return {
    findByIdForOrg: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as ContractRepository;
}

function makeService(
  repo: ProjectChecklistRepository,
  companies: CompanyRepository = fakeCompanyRepo(),
  leads: LeadRepository = fakeLeadRepo(),
  contracts: ContractRepository = fakeContractRepo(),
): ProjectChecklistService {
  return new ProjectChecklistService(repo, companies, leads, contracts);
}

describe("ProjectChecklistService", () => {
  it("create semeia exatamente as 16 fases do tipo INSTITUTIONAL", async () => {
    const repo = fakeRepo();
    const service = makeService(repo);

    await service.create(ORG, { name: "Site X", type: "INSTITUTIONAL" });

    expect(repo.create).toHaveBeenCalledWith(
      { organizationId: ORG, name: "Site X", type: "INSTITUTIONAL" },
      [...INSTITUTIONAL_PHASE_NAMES],
    );
    expect(INSTITUTIONAL_PHASE_NAMES).toHaveLength(16);
  });

  it("create semeia exatamente as 16 fases do tipo SYSTEM", async () => {
    const repo = fakeRepo();
    const service = makeService(repo);

    await service.create(ORG, { name: "Sistema Y", type: "SYSTEM" });

    expect(repo.create).toHaveBeenCalledWith(
      { organizationId: ORG, name: "Sistema Y", type: "SYSTEM" },
      [...SYSTEM_PHASE_NAMES],
    );
    expect(SYSTEM_PHASE_NAMES).toHaveLength(16);
  });

  it("create rejeita companyId que não pertence à organização (não cria o checklist)", async () => {
    const repo = fakeRepo();
    const companies = fakeCompanyRepo({ findByIdForOrg: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo, companies);

    await expect(
      service.create(ORG, { name: "Site X", type: "INSTITUTIONAL", companyId: "company-de-outra-org" }),
    ).rejects.toThrow(NotFoundError);
    expect(companies.findByIdForOrg).toHaveBeenCalledWith("company-de-outra-org", ORG);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("create aceita companyId que pertence à organização", async () => {
    const repo = fakeRepo();
    const companies = fakeCompanyRepo({
      findByIdForOrg: vi.fn().mockResolvedValue({ id: "company-1" }),
    });
    const service = makeService(repo, companies);

    await service.create(ORG, { name: "Site X", type: "INSTITUTIONAL", companyId: "company-1" });

    expect(repo.create).toHaveBeenCalledWith(
      { organizationId: ORG, name: "Site X", type: "INSTITUTIONAL", companyId: "company-1" },
      [...INSTITUTIONAL_PHASE_NAMES],
    );
  });

  it("updatePhaseStatus rejeita NOT_APPLICABLE sem naNote", async () => {
    const repo = fakeRepo();
    const service = makeService(repo);

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
    const service = makeService(repo);

    const phase = await service.updatePhaseStatus(ORG, "checklist-1", 3, {
      status: "NOT_APPLICABLE",
      naNote: "Sem formulário nesse projeto",
    });

    expect(phase.status).toBe("NOT_APPLICABLE");
  });

  it("updatePhaseStatus lança NotFoundError quando a fase não existe/não é da org", async () => {
    const repo = fakeRepo({ updatePhaseStatus: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    await expect(
      service.updatePhaseStatus(ORG, "checklist-1", 3, { status: "DONE" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("delete lança NotFoundError quando o checklist não existe/não é da org", async () => {
    const repo = fakeRepo({ delete: vi.fn().mockResolvedValue(false) });
    const service = makeService(repo);

    await expect(service.delete(ORG, "checklist-x")).rejects.toThrow(NotFoundError);
  });

  it("get lança NotFoundError quando o checklist não existe/não é da org", async () => {
    const repo = fakeRepo({ findByIdForOrg: vi.fn().mockResolvedValue(null) });
    const service = makeService(repo);

    await expect(service.get(ORG, "checklist-x")).rejects.toThrow(NotFoundError);
  });
});

describe("computeProgressPercent", () => {
  it("trata NOT_APPLICABLE como concluída, igual DONE", () => {
    const phases = [
      { status: "DONE" as const },
      { status: "NOT_APPLICABLE" as const },
      { status: "IN_PROGRESS" as const },
      { status: "NOT_STARTED" as const },
    ];

    expect(computeProgressPercent(phases)).toBe(50);
  });

  it("retorna 100 quando todas as fases estão DONE ou NOT_APPLICABLE", () => {
    const phases = [
      { status: "DONE" as const },
      { status: "NOT_APPLICABLE" as const },
      { status: "DONE" as const },
    ];

    expect(computeProgressPercent(phases)).toBe(100);
  });

  it("retorna 0 quando não há fases (evita divisão por zero)", () => {
    expect(computeProgressPercent([])).toBe(0);
  });
});
