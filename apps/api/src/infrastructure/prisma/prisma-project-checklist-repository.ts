import { prisma } from "@millead/database";
import { computeProgressPercent } from "../../application/services/project-checklist-service.js";
import type {
  ProjectChecklist,
  ProjectChecklistDetail,
  ProjectChecklistPhase,
  ProjectChecklistSummary,
} from "../../domain/entities/project-checklist.js";
import type {
  CreateProjectChecklistInput,
  ProjectChecklistRepository,
  UpdatePhaseStatusInput,
} from "../../domain/repositories/project-checklist-repository.js";

function toDomainChecklist(row: {
  id: string;
  organizationId: string;
  name: string;
  type: ProjectChecklist["type"];
  companyId: string | null;
  localFolder: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectChecklist {
  return { ...row };
}

function toDomainPhase(row: {
  id: string;
  projectChecklistId: string;
  phaseNumber: number;
  phaseName: string;
  status: ProjectChecklistPhase["status"];
  naNote: string | null;
  updatedAt: Date;
}): ProjectChecklistPhase {
  return { ...row };
}

export class PrismaProjectChecklistRepository implements ProjectChecklistRepository {
  async create(
    input: CreateProjectChecklistInput,
    phaseNames: string[],
  ): Promise<ProjectChecklistDetail> {
    const row = await prisma.projectChecklist.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        companyId: input.companyId ?? null,
        localFolder: input.localFolder ?? null,
        phases: {
          create: phaseNames.map((phaseName, index) => ({
            organizationId: input.organizationId,
            phaseNumber: index + 1,
            phaseName,
          })),
        },
      },
      include: { phases: { orderBy: { phaseNumber: "asc" } } },
    });
    const { phases, ...checklist } = row;
    const domainPhases = phases.map(toDomainPhase);
    return {
      ...toDomainChecklist(checklist),
      phases: domainPhases,
      progressPercent: computeProgressPercent(domainPhases),
    };
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<ProjectChecklistDetail | null> {
    const row = await prisma.projectChecklist.findFirst({
      where: { id, organizationId },
      include: { phases: { orderBy: { phaseNumber: "asc" } } },
    });
    if (!row) return null;
    const { phases, ...checklist } = row;
    const domainPhases = phases.map(toDomainPhase);
    return {
      ...toDomainChecklist(checklist),
      phases: domainPhases,
      progressPercent: computeProgressPercent(domainPhases),
    };
  }

  async list(organizationId: string): Promise<ProjectChecklistSummary[]> {
    const rows = await prisma.projectChecklist.findMany({
      where: { organizationId },
      include: { phases: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(({ phases, ...checklist }) => ({
      ...toDomainChecklist(checklist),
      progressPercent: computeProgressPercent(phases),
    }));
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await prisma.projectChecklist.deleteMany({ where: { id, organizationId } });
    return result.count > 0;
  }

  async updatePhaseStatus(
    projectChecklistId: string,
    organizationId: string,
    phaseNumber: number,
    input: UpdatePhaseStatusInput,
  ): Promise<ProjectChecklistPhase | null> {
    // Confirma que o checklist é da org antes de tocar na fase -- sem isso,
    // um id de checklist de outra org com o mesmo phaseNumber passaria pelo
    // updateMany abaixo (que só filtra por organizationId na FASE, não no pai).
    const checklist = await prisma.projectChecklist.findFirst({
      where: { id: projectChecklistId, organizationId },
      select: { id: true },
    });
    if (!checklist) return null;

    const result = await prisma.projectChecklistPhase.updateMany({
      where: { projectChecklistId, phaseNumber, organizationId },
      data: { status: input.status, naNote: input.naNote ?? null },
    });
    if (result.count === 0) return null;

    const row = await prisma.projectChecklistPhase.findFirst({
      where: { projectChecklistId, phaseNumber, organizationId },
    });
    return row ? toDomainPhase(row) : null;
  }
}
