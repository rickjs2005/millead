# Project Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ProjectChecklist` module to MilLead so Rick can see, per project, the 16-phase progress (institutional or system track) visually in the CRM — mirroring the same phases already tracked in each project's local `.claude/project-state.md`.

**Architecture:** New module following the exact Clean Architecture layering already used by the `Lead` module (domain → application → infrastructure → interfaces), plus a frontend page pair (list + detail) using the existing shadcn/Radix component set. Automated sync from Claude Code's skills authenticates via a static API key checked by a new `apiKeyOrSession` middleware (same pattern as the existing MilSocial `ownerOrSyncKey`), never touching the JWT session flow.

**Tech Stack:** Express + TypeScript (API), Prisma + PostgreSQL (DB), Next.js 15 + React 19 + TanStack Query + react-hook-form + Zod + shadcn/Radix (web).

**Spec:** `docs/superpowers/specs/2026-08-24-project-checklist-design.md`

## Global Constraints

- Multi-tenant: every new table has `organizationId`, every repository method scopes by it, matching `Lead`/`LeadContact`.
- RLS: the new tables must have `ENABLE ROW LEVEL SECURITY` explicitly in the migration (not just relying on `ensure-rls.sql`, which only runs on `migrate:deploy`, not on local `migrate dev`).
- Checklist tracks **phase-level status only** (16 rows), never sub-item detail — sub-items stay in the `site-institucional`/`sistema-web` SKILL.md files, not in this database.
- Phase names come from a hardcoded `PHASE_TEMPLATES` map in the application layer (`INSTITUTIONAL_PHASE_NAMES`, `SYSTEM_PHASE_NAMES`), copied verbatim from the two SKILL.md files' `## Fase NN` headers. This duplication (SKILL.md vs. `PHASE_TEMPLATES`) is an accepted trade-off from the spec — do not build a sync mechanism between them.
- `naNote` is required whenever a phase's status is `NOT_APPLICABLE` — enforced in `ProjectChecklistService.updatePhaseStatus` (unit-testable without HTTP), not only at the Zod/DTO layer.
- The automation auth path (`apiKeyOrSession`) must never fall back to the session flow when the `X-Automation-Key` header is present but wrong — invalid header is a hard 401, exactly like `ownerOrSyncKey` in `social-routes.ts`.
- All new backend files use `.js` extensions in relative imports (ESM), matching every existing file in `apps/api/src`.
- Work happens directly on the already-checked-out branch `feat/project-checklist` in `C:\Users\rickj\projetos\millead` (not a separate git worktree) — the repo's `.env` (gitignored, holds the real dev `DATABASE_URL` for the Supabase dev instance) must stay available for `prisma migrate dev`, and a fresh worktree would not carry it.

## Out of scope for this plan

The spec's "Sincronização com `.md`" section (updating `projetos/CLAUDE.md` and the `site-institucional`/`sistema-web` SKILL.md files to actually call this new API from a Claude Code session) touches a different, non-git-tracked location (`C:\Users\rickj\projetos\CLAUDE.md` and `C:\Users\rickj\.claude\skills\...`) outside this repo and this branch. It is **not** a task in this plan — do it as a separate, direct edit after this plan's branch is merged and deployed, not via a task here.

---

### Task 1: Database schema, migration, RLS

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: Prisma models `ProjectChecklist`, `ProjectChecklistPhase` and enums `ProjectChecklistType` (`INSTITUTIONAL` | `SYSTEM`), `ProjectChecklistPhaseStatus` (`NOT_STARTED` | `IN_PROGRESS` | `DONE` | `NOT_APPLICABLE`) — every later task imports these enum types from `@millead/database`.

- [ ] **Step 1: Add the two enums and two models to schema.prisma**

Add near the other enums (e.g. right after the `LeadStatus` enum block, `packages/database/prisma/schema.prisma` around line 344):

```prisma
enum ProjectChecklistType {
  INSTITUTIONAL
  SYSTEM

  @@map("project_checklist_type")
}

enum ProjectChecklistPhaseStatus {
  NOT_STARTED
  IN_PROGRESS
  DONE
  NOT_APPLICABLE

  @@map("project_checklist_phase_status")
}
```

Add near the other org-scoped models (e.g. right after the `model LeadContact` block):

```prisma
model ProjectChecklist {
  id             String               @id @default(cuid())
  organizationId String               @map("organization_id")
  name           String
  type           ProjectChecklistType
  companyId      String?              @map("company_id")
  localFolder    String?              @map("local_folder")
  createdAt      DateTime             @default(now()) @map("created_at")
  updatedAt      DateTime             @updatedAt @map("updated_at")

  organization Organization            @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  company      Company?                @relation(fields: [companyId], references: [id], onDelete: SetNull)
  phases       ProjectChecklistPhase[]

  @@index([organizationId])
  @@map("project_checklists")
}

model ProjectChecklistPhase {
  id                 String                       @id @default(cuid())
  organizationId     String                       @map("organization_id")
  projectChecklistId String                       @map("project_checklist_id")
  phaseNumber        Int                          @map("phase_number")
  phaseName          String                       @map("phase_name")
  status             ProjectChecklistPhaseStatus  @default(NOT_STARTED)
  naNote             String?                      @map("na_note")
  updatedAt          DateTime                     @updatedAt @map("updated_at")

  organization     Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  projectChecklist ProjectChecklist @relation(fields: [projectChecklistId], references: [id], onDelete: Cascade)

  @@unique([projectChecklistId, phaseNumber])
  @@index([organizationId])
  @@index([projectChecklistId])
  @@map("project_checklist_phases")
}
```

- [ ] **Step 2: Add the two relation lines to `model Organization`**

In `model Organization` (around line 68-892 per the field list), add two lines into the relations block (alongside `leads Lead[]` / `leadContacts LeadContact[]`):

```prisma
  projectChecklists      ProjectChecklist[]
  projectChecklistPhases ProjectChecklistPhase[]
```

- [ ] **Step 3: Add the relation line to `model Company`**

In `model Company` (around line 253-282), add alongside `leads Lead[]`:

```prisma
  projectChecklists ProjectChecklist[]
```

- [ ] **Step 4: Format the schema**

Run: `pnpm --filter @millead/database exec prisma format`
Expected: exits 0, reformats field alignment (Prisma's formatter right-aligns types automatically) — review the diff, it should only touch whitespace plus the blocks just added.

- [ ] **Step 5: Generate the migration (create-only, so RLS can be added by hand before applying)**

Run: `pnpm --filter @millead/database exec prisma migrate dev --name add_project_checklists --create-only`
Expected: creates a new folder `packages/database/prisma/migrations/<TIMESTAMP>_add_project_checklists/migration.sql` with `CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ALTER TABLE ... ADD CONSTRAINT` statements for both new tables. Note the exact folder name it generates (you'll need it for Step 7).

- [ ] **Step 6: Append explicit RLS enabling to the generated migration.sql**

Open the migration.sql file generated in Step 5 and append at the end:

```sql

-- RLS explícita: ensure-rls.sql roda de novo em todo migrate:deploy (idempotente),
-- mas só nesse momento -- não no "prisma migrate dev" local. Habilitar aqui
-- também deixa o dev local protegido desde já (mesma convenção desde a
-- migration 20260818140000_enable_rls_all_public_tables).
ALTER TABLE "project_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_checklist_phases" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 7: Apply the migration**

Run: `pnpm db:migrate` (from repo root; wraps `prisma migrate dev`, which will detect the pending create-only migration and apply it without generating a new one)
Expected: output ends with `Your database is now in sync with your schema.` and no new migration folder is created (only the one from Step 5 is applied).

- [ ] **Step 8: Regenerate the Prisma client**

Run: `pnpm db:generate`
Expected: exits 0; `ProjectChecklistType`, `ProjectChecklistPhaseStatus`, `prisma.projectChecklist`, `prisma.projectChecklistPhase` are now available from `@millead/database`.

- [ ] **Step 9: Verify**

Run: `pnpm --filter @millead/database exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 10: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add ProjectChecklist and ProjectChecklistPhase tables"
```

---

### Task 2: Permissions catalog

**Files:**
- Modify: `packages/database/src/permissions.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `PERMISSIONS.PROJECT_CHECKLISTS_READ` = `"project-checklists:read"`, `PERMISSIONS.PROJECT_CHECKLISTS_WRITE` = `"project-checklists:write"` — every later backend task (routes, container wiring) uses these two constants by name.

- [ ] **Step 1: Add the two permission keys**

In `packages/database/src/permissions.ts`, add two lines to the `PERMISSIONS` object (after `SETTINGS_MANAGE`, before the closing `} as const;`):

```typescript
  PROJECT_CHECKLISTS_READ: "project-checklists:read",
  PROJECT_CHECKLISTS_WRITE: "project-checklists:write",
```

- [ ] **Step 2: Add read access to the Viewer role**

Add `PERMISSIONS.PROJECT_CHECKLISTS_READ` to the `READ_ONLY_PERMISSIONS` array (append at the end of the array). Do **not** add either key to `SALES_PERMISSIONS` — this is engineering/process tooling, not a sales-role concern. `ALL_PERMISSIONS`/`ADMIN_PERMISSIONS` (Owner/Admin roles) pick up both new keys automatically since they derive from `Object.values(PERMISSIONS)`.

- [ ] **Step 3: Re-seed to sync the DB's `Permission`/`RolePermission` tables**

Run: `pnpm db:seed`
Expected: logs `Seed: catálogo de permissões...` then `Seed: papéis padrão...`, exits 0. This is idempotent (upsert + full `RolePermission` resync per role), safe to re-run.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/permissions.ts
git commit -m "feat(auth): add project-checklists:read/write permissions"
```

---

### Task 3: Domain layer — entities and repository interface

**Files:**
- Create: `apps/api/src/domain/entities/project-checklist.ts`
- Create: `apps/api/src/domain/repositories/project-checklist-repository.ts`

**Interfaces:**
- Consumes: `ProjectChecklistType`, `ProjectChecklistPhaseStatus` from `@millead/database` (Task 1).
- Produces: types `ProjectChecklist`, `ProjectChecklistPhase`, `ProjectChecklistDetail`, `ProjectChecklistSummary` and interface `ProjectChecklistRepository` (methods `create`, `findByIdForOrg`, `list`, `delete`, `updatePhaseStatus`) — consumed by Task 4 (service) and Task 5 (Prisma implementation).

- [ ] **Step 1: Write the domain entity file**

Create `apps/api/src/domain/entities/project-checklist.ts`:

```typescript
import type { ProjectChecklistPhaseStatus, ProjectChecklistType } from "@millead/database";

export interface ProjectChecklist {
  id: string;
  organizationId: string;
  name: string;
  type: ProjectChecklistType;
  companyId: string | null;
  localFolder: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectChecklistPhase {
  id: string;
  projectChecklistId: string;
  phaseNumber: number;
  phaseName: string;
  status: ProjectChecklistPhaseStatus;
  naNote: string | null;
  updatedAt: Date;
}

export interface ProjectChecklistDetail extends ProjectChecklist {
  phases: ProjectChecklistPhase[];
}

/** Usado na listagem: progresso 0-100, DONE + NOT_APPLICABLE contam como concluídas sobre as 16 fases. */
export interface ProjectChecklistSummary extends ProjectChecklist {
  progressPercent: number;
}
```

- [ ] **Step 2: Write the repository interface**

Create `apps/api/src/domain/repositories/project-checklist-repository.ts`:

```typescript
import type { ProjectChecklistPhaseStatus, ProjectChecklistType } from "@millead/database";
import type {
  ProjectChecklistDetail,
  ProjectChecklistPhase,
  ProjectChecklistSummary,
} from "../entities/project-checklist.js";

export interface CreateProjectChecklistInput {
  organizationId: string;
  name: string;
  type: ProjectChecklistType;
  companyId?: string | null;
  localFolder?: string | null;
}

export interface UpdatePhaseStatusInput {
  status: ProjectChecklistPhaseStatus;
  naNote?: string | null;
}

export interface ProjectChecklistRepository {
  /** `phaseNames` já vem na ordem 1..N -- a implementação semeia phaseNumber = index + 1. */
  create(
    input: CreateProjectChecklistInput,
    phaseNames: string[],
  ): Promise<ProjectChecklistDetail>;
  findByIdForOrg(id: string, organizationId: string): Promise<ProjectChecklistDetail | null>;
  list(organizationId: string): Promise<ProjectChecklistSummary[]>;
  delete(id: string, organizationId: string): Promise<boolean>;
  updatePhaseStatus(
    projectChecklistId: string,
    organizationId: string,
    phaseNumber: number,
    input: UpdatePhaseStatusInput,
  ): Promise<ProjectChecklistPhase | null>;
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @millead/api type-check`
Expected: exits 0 (these two files have no implementation to break yet, just need to parse/type-check cleanly against `@millead/database`'s generated types from Task 1).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/domain/entities/project-checklist.ts apps/api/src/domain/repositories/project-checklist-repository.ts
git commit -m "feat(project-checklist): add domain entity and repository interface"
```

---

### Task 4: Application layer — DTOs, service, service test

**Files:**
- Create: `apps/api/src/application/dto/project-checklist.dto.ts`
- Create: `apps/api/src/application/services/project-checklist-service.ts`
- Test: `apps/api/src/application/services/project-checklist-service.test.ts`

**Interfaces:**
- Consumes: `ProjectChecklistRepository`, `CreateProjectChecklistInput`, `UpdatePhaseStatusInput` (Task 3); `NotFoundError`, `ValidationError` from `apps/api/src/domain/errors/app-error.ts` (already exists).
- Produces: `createProjectChecklistSchema`, `updatePhaseStatusSchema` (Zod, Task 7 imports these into routes); `ProjectChecklistService` class with `create`, `list`, `get`, `delete`, `updatePhaseStatus` methods, plus exported constants `INSTITUTIONAL_PHASE_NAMES`, `SYSTEM_PHASE_NAMES`, `PHASE_TEMPLATES` (Task 7's container.ts instantiates `ProjectChecklistService`).

- [ ] **Step 1: Write the DTO file**

Create `apps/api/src/application/dto/project-checklist.dto.ts`:

```typescript
import { z } from "zod";

export const createProjectChecklistSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["INSTITUTIONAL", "SYSTEM"]),
  companyId: z.string().min(1).optional(),
  localFolder: z.string().min(1).max(200).optional(),
});
export type CreateProjectChecklistInput = z.infer<typeof createProjectChecklistSchema>;

export const updatePhaseStatusSchema = z
  .object({
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "NOT_APPLICABLE"]),
    naNote: z.string().min(1).max(500).optional(),
  })
  .refine((data) => data.status !== "NOT_APPLICABLE" || !!data.naNote, {
    message: "naNote é obrigatório quando status é NOT_APPLICABLE.",
    path: ["naNote"],
  });
export type UpdatePhaseStatusInput = z.infer<typeof updatePhaseStatusSchema>;
```

- [ ] **Step 2: Write the service**

Create `apps/api/src/application/services/project-checklist-service.ts`:

```typescript
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  CreateProjectChecklistInput,
  ProjectChecklistRepository,
  UpdatePhaseStatusInput,
} from "../../domain/repositories/project-checklist-repository.js";

/** Copiado literalmente dos headers "## Fase NN" da skill site-institucional (SKILL.md). */
export const INSTITUTIONAL_PHASE_NAMES = [
  "Briefing e descoberta",
  "Arquitetura do site",
  "UX",
  "UI / Design",
  "Conteúdo",
  "Frontend",
  "Motion Design",
  "SEO On-Page",
  "Performance",
  "Acessibilidade",
  "Analytics e conversão",
  "Segurança",
  "QA",
  "Deploy",
  "Indexação",
  "Entrega",
] as const;

/** Copiado literalmente dos headers "## Fase NN" da skill sistema-web (SKILL.md). */
export const SYSTEM_PHASE_NAMES = [
  "Descoberta e arquitetura",
  "UX/UI",
  "Modelagem do banco",
  "Backend",
  "Autenticação e autorização (RBAC)",
  "Frontend",
  "Integrações",
  "Segurança",
  "Testes",
  "Performance",
  "Observabilidade",
  "Infraestrutura",
  "QA final",
  "Deploy",
  "SEO para páginas públicas",
  "Pós-lançamento",
] as const;

export const PHASE_TEMPLATES = {
  INSTITUTIONAL: INSTITUTIONAL_PHASE_NAMES,
  SYSTEM: SYSTEM_PHASE_NAMES,
} as const;

export class ProjectChecklistService {
  constructor(private readonly projectChecklists: ProjectChecklistRepository) {}

  async create(
    organizationId: string,
    input: Omit<CreateProjectChecklistInput, "organizationId">,
  ) {
    const phaseNames = PHASE_TEMPLATES[input.type];
    return this.projectChecklists.create({ organizationId, ...input }, [...phaseNames]);
  }

  async list(organizationId: string) {
    return this.projectChecklists.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const checklist = await this.projectChecklists.findByIdForOrg(id, organizationId);
    if (!checklist) throw new NotFoundError("Checklist de projeto não encontrado.");
    return checklist;
  }

  async delete(organizationId: string, id: string) {
    const deleted = await this.projectChecklists.delete(id, organizationId);
    if (!deleted) throw new NotFoundError("Checklist de projeto não encontrado.");
  }

  async updatePhaseStatus(
    organizationId: string,
    projectChecklistId: string,
    phaseNumber: number,
    input: UpdatePhaseStatusInput,
  ) {
    if (input.status === "NOT_APPLICABLE" && !input.naNote) {
      throw new ValidationError("naNote é obrigatório quando o status é NOT_APPLICABLE.");
    }
    const phase = await this.projectChecklists.updatePhaseStatus(
      projectChecklistId,
      organizationId,
      phaseNumber,
      input,
    );
    if (!phase) throw new NotFoundError("Fase não encontrada.");
    return phase;
  }
}
```

- [ ] **Step 3: Write the failing tests first**

Create `apps/api/src/application/services/project-checklist-service.test.ts`:

```typescript
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
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @millead/api exec vitest run project-checklist-service`
Expected: 7/7 tests pass (service and test were written together in this task, so this confirms wiring, not a red→green cycle — there's no pre-existing implementation to be red against).

- [ ] **Step 5: Type-check**

Run: `pnpm --filter @millead/api type-check`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/application/dto/project-checklist.dto.ts apps/api/src/application/services/project-checklist-service.ts apps/api/src/application/services/project-checklist-service.test.ts
git commit -m "feat(project-checklist): add DTOs and service with phase-template seeding"
```

---

### Task 5: Infrastructure layer — Prisma repository

**Files:**
- Create: `apps/api/src/infrastructure/prisma/prisma-project-checklist-repository.ts`

**Interfaces:**
- Consumes: `ProjectChecklistRepository` interface (Task 3), `prisma` client from `@millead/database` (Task 1's generated client, with `prisma.projectChecklist` / `prisma.projectChecklistPhase` models).
- Produces: `PrismaProjectChecklistRepository` class — Task 7's `container.ts` instantiates this and passes it into `ProjectChecklistService`.

- [ ] **Step 1: Write the repository implementation**

Create `apps/api/src/infrastructure/prisma/prisma-project-checklist-repository.ts`:

```typescript
import { prisma } from "@millead/database";
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

function computeProgressPercent(phases: { status: string }[]): number {
  if (phases.length === 0) return 0;
  const done = phases.filter((p) => p.status === "DONE" || p.status === "NOT_APPLICABLE").length;
  return Math.round((done / phases.length) * 100);
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
    return { ...toDomainChecklist(checklist), phases: phases.map(toDomainPhase) };
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<ProjectChecklistDetail | null> {
    const row = await prisma.projectChecklist.findFirst({
      where: { id, organizationId },
      include: { phases: { orderBy: { phaseNumber: "asc" } } },
    });
    if (!row) return null;
    const { phases, ...checklist } = row;
    return { ...toDomainChecklist(checklist), phases: phases.map(toDomainPhase) };
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
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @millead/api type-check`
Expected: exits 0 — this is the step most likely to surface a Prisma field-name mismatch against Task 1's schema (e.g. wrong relation name); fix any mismatch by matching Task 1's exact field names, don't rename Task 1's schema to fit this file.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/infrastructure/prisma/prisma-project-checklist-repository.ts
git commit -m "feat(project-checklist): add Prisma repository implementation"
```

---

### Task 6: Automation auth middleware (API-key sync path)

**Files:**
- Create: `apps/api/src/interfaces/http/middlewares/api-key-or-session.ts`
- Test: `apps/api/src/interfaces/http/middlewares/api-key-or-session.test.ts`
- Modify: `apps/api/src/config/env.ts`
- Modify: `.env.example`
- Modify: `render.yaml`

**Interfaces:**
- Consumes: `PermissionKey` type from `@millead/database/permissions`; `UnauthorizedError` from `apps/api/src/domain/errors/app-error.ts`.
- Produces: `apiKeyOrSession(apiKey, organizationId, permissions, authenticate)` function returning an Express `RequestHandler` — Task 7's `container.ts` calls this to build `projectChecklistAuthenticate`. `env.AUTOMATION_API_KEY` (string | undefined), `env.AUTOMATION_ORGANIZATION_ID` (string | undefined) — Task 7 reads these.

- [ ] **Step 1: Write the middleware**

Create `apps/api/src/interfaces/http/middlewares/api-key-or-session.ts`:

```typescript
import { timingSafeEqual } from "node:crypto";
import type { PermissionKey } from "@millead/database/permissions";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthorizedError } from "../../../domain/errors/app-error.js";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a),
    bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Rotas de automação (ex.: sync do project-checklist a partir das skills do
 * Claude Code) aceitam DUAS formas de auth: sessão normal (JWT) OU header
 * X-Automation-Key. Header presente decide a rota na hora -- inválido é 401
 * direto, sem fallback pra sessão (mesmo desenho do ownerOrSyncKey do
 * MilSocial, ver interfaces/http/routes/social-routes.ts).
 */
export function apiKeyOrSession(
  apiKey: string | undefined,
  organizationId: string | undefined,
  permissions: readonly PermissionKey[],
  authenticate: RequestHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["x-automation-key"];
    if (typeof header === "string") {
      if (apiKey && organizationId && safeEqual(header, apiKey)) {
        req.auth = {
          id: "automation",
          userId: "automation",
          organizationId,
          roleId: "automation",
          status: "ACTIVE",
          organizationName: "Automação",
          organizationSlug: "automation",
          roleName: "Automação",
          permissions: [...permissions],
          userIsActive: true,
        };
        next();
        return;
      }
      next(new UnauthorizedError("Chave de automação inválida."));
      return;
    }
    authenticate(req, res, next);
  };
}
```

- [ ] **Step 2: Write the tests**

Create `apps/api/src/interfaces/http/middlewares/api-key-or-session.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import type { Request, RequestHandler, Response } from "express";
import { apiKeyOrSession } from "./api-key-or-session.js";

const PERMISSIONS = ["project-checklists:read", "project-checklists:write"] as const;
const KEY = "chave-secreta-com-24-ou-mais-chars";

function fakeReqRes(headers: Record<string, string> = {}) {
  const req = { headers, auth: undefined } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();
  return { req, res, next };
}

describe("apiKeyOrSession", () => {
  it("popula req.auth quando o header bate com a chave configurada", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(KEY, "org-1", PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({ "x-automation-key": KEY });

    middleware(req, res, next);

    expect(req.auth).toMatchObject({ organizationId: "org-1", permissions: [...PERMISSIONS] });
    expect(next).toHaveBeenCalledWith();
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("chama next com erro quando o header vem errado, sem cair pra sessão", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(KEY, "org-1", PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({ "x-automation-key": "chave-errada" });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("cai pro fluxo de sessão normal quando o header está ausente", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(KEY, "org-1", PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({});

    middleware(req, res, next);

    expect(authenticate).toHaveBeenCalledWith(req, res, next);
  });

  it("rejeita mesmo com header certo se a key/organizationId não estiverem configurados", () => {
    const authenticate = vi.fn() as unknown as RequestHandler;
    const middleware = apiKeyOrSession(undefined, undefined, PERMISSIONS, authenticate);
    const { req, res, next } = fakeReqRes({ "x-automation-key": KEY });

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @millead/api exec vitest run api-key-or-session`
Expected: 4/4 pass.

- [ ] **Step 4: Add the two env vars**

In `apps/api/src/config/env.ts`, add inside `envSchema` (after `OWNER_EMAIL`):

```typescript
  // ===== Automação de checklist de projetos (Claude Code, sem sessão) =====
  // Chave usada pelas skills site-institucional/sistema-web pra sincronizar
  // project-state.md com o MilLead sem login. Opcional: sem ela, as rotas
  // /api/v1/project-checklists continuam funcionando normalmente por sessão
  // de usuário -- só a sincronização automática fica desativada.
  AUTOMATION_API_KEY: z.string().min(24).optional(),
  AUTOMATION_ORGANIZATION_ID: z.string().optional(),
```

- [ ] **Step 5: Document the two env vars in `.env.example`**

In `.env.example`, add near the `MILSOCIAL_SYNC_KEY` block:

```
# Chave para as skills do Claude Code (site-institucional/sistema-web)
# sincronizarem o checklist de projetos sem sessão de usuário. Opcional --
# sem ela, a sincronização automática fica desativada (o painel continua
# funcionando normalmente por login).
# Gere com: openssl rand -hex 24
# AUTOMATION_API_KEY="gere-com-openssl-rand-hex-24"
# AUTOMATION_ORGANIZATION_ID="cole-aqui-o-id-da-organizacao-milweb"
```

- [ ] **Step 6: Add the two env vars to `render.yaml`**

In `render.yaml`, add near the `MILSOCIAL_SYNC_KEY` entry:

```yaml
      - key: AUTOMATION_API_KEY
        sync: false # gerada com openssl rand -hex 24; guardada em ~/.claude/millead-api-key na máquina do Rick
      - key: AUTOMATION_ORGANIZATION_ID
        sync: false # id da organização MilWeb (ver packages/database/prisma/seed.ts)
```

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @millead/api type-check`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/interfaces/http/middlewares/api-key-or-session.ts apps/api/src/interfaces/http/middlewares/api-key-or-session.test.ts apps/api/src/config/env.ts .env.example render.yaml
git commit -m "feat(auth): add API-key automation path for project-checklist sync"
```

---

### Task 7: Interfaces layer — controller, routes, container/app wiring

**Files:**
- Create: `apps/api/src/interfaces/http/controllers/project-checklist-controller.ts`
- Create: `apps/api/src/interfaces/http/routes/project-checklist-routes.ts`
- Modify: `apps/api/src/main/container.ts`
- Modify: `apps/api/src/main/app.ts`

**Interfaces:**
- Consumes: `ProjectChecklistService` (Task 4), `PrismaProjectChecklistRepository` (Task 5), `apiKeyOrSession` + `env.AUTOMATION_API_KEY`/`env.AUTOMATION_ORGANIZATION_ID` (Task 6), `PERMISSIONS.PROJECT_CHECKLISTS_READ`/`WRITE` (Task 2), `createProjectChecklistSchema`/`updatePhaseStatusSchema` (Task 4).
- Produces: `POST/GET /api/v1/project-checklists`, `GET/DELETE /api/v1/project-checklists/:id`, `PATCH /api/v1/project-checklists/:id/phases/:phaseNumber` — mounted and reachable end-to-end; `container.projectChecklistController` and `container.projectChecklistAuthenticate` exposed for potential future use.

- [ ] **Step 1: Write the controller**

Create `apps/api/src/interfaces/http/controllers/project-checklist-controller.ts`:

```typescript
import type { Request, Response } from "express";
import type { ProjectChecklistService } from "../../../application/services/project-checklist-service.js";
import { requireAuth } from "../require-auth.js";

export class ProjectChecklistController {
  constructor(private readonly projectChecklists: ProjectChecklistService) {}

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const checklist = await this.projectChecklists.create(auth.organizationId, req.body);
    res.status(201).json(checklist);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const checklists = await this.projectChecklists.list(auth.organizationId);
    res.status(200).json(checklists);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const checklist = await this.projectChecklists.get(auth.organizationId, req.params.id!);
    res.status(200).json(checklist);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.projectChecklists.delete(auth.organizationId, req.params.id!);
    res.status(204).send();
  };

  updatePhaseStatus = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    const phaseNumber = Number(req.params.phaseNumber);
    const phase = await this.projectChecklists.updatePhaseStatus(
      auth.organizationId,
      req.params.id!,
      phaseNumber,
      req.body,
    );
    res.status(200).json(phase);
  };
}
```

- [ ] **Step 2: Write the routes**

Create `apps/api/src/interfaces/http/routes/project-checklist-routes.ts`:

```typescript
import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createProjectChecklistSchema,
  updatePhaseStatusSchema,
} from "../../../application/dto/project-checklist.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { ProjectChecklistController } from "../controllers/project-checklist-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

export function createProjectChecklistRoutes(
  controller: ProjectChecklistController,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROJECT_CHECKLISTS_READ);
  const write = requirePermission(PERMISSIONS.PROJECT_CHECKLISTS_WRITE);

  router.post(
    "/",
    write,
    validateBody(createProjectChecklistSchema),
    asyncHandler(controller.create),
  );
  router.get("/", read, asyncHandler(controller.list));
  router.get("/:id", read, asyncHandler(controller.get));
  router.delete("/:id", write, asyncHandler(controller.delete));
  router.patch(
    "/:id/phases/:phaseNumber",
    write,
    validateBody(updatePhaseStatusSchema),
    asyncHandler(controller.updatePhaseStatus),
  );

  return router;
}
```

- [ ] **Step 3: Wire into `container.ts`**

In `apps/api/src/main/container.ts`:

Add imports (alongside the other `Prisma*Repository`/`*Service`/`*Controller` imports):

```typescript
import { PERMISSIONS } from "@millead/database/permissions";
import { apiKeyOrSession } from "../interfaces/http/middlewares/api-key-or-session.js";
import { PrismaProjectChecklistRepository } from "../infrastructure/prisma/prisma-project-checklist-repository.js";
import { ProjectChecklistService } from "../application/services/project-checklist-service.js";
import { ProjectChecklistController } from "../interfaces/http/controllers/project-checklist-controller.js";
```

Add to the `Container` interface:

```typescript
  projectChecklistController: ProjectChecklistController;
  projectChecklistAuthenticate: RequestHandler;
```

Inside `buildContainer()`, add to the "Repositórios" section:

```typescript
  const projectChecklistRepository = new PrismaProjectChecklistRepository();
```

Add to the "Serviços" section:

```typescript
  const projectChecklistService = new ProjectChecklistService(projectChecklistRepository);
```

Add to the "Controllers & middlewares" section, right after `const authenticate = createAuthenticateMiddleware(...)`:

```typescript
  const projectChecklistController = new ProjectChecklistController(projectChecklistService);
  const projectChecklistAuthenticate = apiKeyOrSession(
    env.AUTOMATION_API_KEY,
    env.AUTOMATION_ORGANIZATION_ID,
    [PERMISSIONS.PROJECT_CHECKLISTS_READ, PERMISSIONS.PROJECT_CHECKLISTS_WRITE],
    authenticate,
  );
```

Add both to the returned object:

```typescript
    projectChecklistController,
    projectChecklistAuthenticate,
```

- [ ] **Step 4: Wire into `app.ts`**

In `apps/api/src/main/app.ts`, add to the import block:

```typescript
import { createProjectChecklistRoutes } from "../interfaces/http/routes/project-checklist-routes.js";
```

Add a mount line among the plain (non-public) modules, e.g. right after the `/api/v1/leads` mount:

```typescript
  app.use(
    "/api/v1/project-checklists",
    createProjectChecklistRoutes(
      container.projectChecklistController,
      container.projectChecklistAuthenticate,
    ),
  );
```

(placed before the final `app.use((req, res) => {...})` 404 handler, like every other module.)

- [ ] **Step 5: Type-check and run the full API test suite**

Run: `pnpm --filter @millead/api type-check`
Expected: exits 0.

Run: `pnpm --filter @millead/api test`
Expected: all existing tests plus the ones from Tasks 4 and 6 pass, 0 failures.

- [ ] **Step 6: Manual smoke test against the real dev DB**

Run: `pnpm dev:api` in one terminal (leave running), then in another terminal:

```bash
curl -s -X POST http://localhost:4000/api/v1/project-checklists \
  -H "X-Automation-Key: <valor de AUTOMATION_API_KEY no .env>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke test","type":"INSTITUTIONAL","localFolder":"smoke-test"}'
```

Expected: `201` with a JSON body containing `"phases"` as an array of 16 objects, `phaseNumber` 1..16, all `"status":"NOT_STARTED"`. Then:

```bash
curl -s http://localhost:4000/api/v1/project-checklists -H "X-Automation-Key: <same key>"
```

Expected: `200` with an array containing the just-created checklist, `"progressPercent":0`. Delete it afterward (`DELETE /api/v1/project-checklists/<id>` with the same header) so the smoke-test row doesn't linger in the dev DB. If `AUTOMATION_API_KEY`/`AUTOMATION_ORGANIZATION_ID` aren't set in the local `.env` yet, generate a key with `openssl rand -hex 24`, add both to `.env` (using the real MilWeb organization id — query it with `pnpm --filter @millead/database exec prisma studio` or `SELECT id FROM organizations WHERE slug = 'milweb';`), restart `pnpm dev:api`, then retry.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/interfaces/http/controllers/project-checklist-controller.ts apps/api/src/interfaces/http/routes/project-checklist-routes.ts apps/api/src/main/container.ts apps/api/src/main/app.ts
git commit -m "feat(project-checklist): wire controller, routes, and automation auth into the API"
```

---

### Task 8: Frontend data layer — types, service, query keys, hooks, nav

**Files:**
- Modify: `apps/web/src/types/api.ts`
- Create: `apps/web/src/services/project-checklists.ts`
- Modify: `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/features/project-checklists/hooks.ts`
- Modify: `apps/web/src/components/shell/nav-items.ts`

**Interfaces:**
- Consumes: `api` client from `apps/web/src/services/api-client.ts` (existing), `ApiError` (existing).
- Produces: types `ProjectChecklistType`, `ProjectChecklistPhaseStatus`, `ProjectChecklist`, `ProjectChecklistSummary`, `ProjectChecklistDetail`, `ProjectChecklistPhase`; `projectChecklistsService`; hooks `useProjectChecklists`, `useProjectChecklist`, `useCreateProjectChecklist`, `useUpdatePhaseStatus`, `useDeleteProjectChecklist` — consumed by Tasks 9 and 10.

- [ ] **Step 1: Extend `PermissionKey` and add the new types**

In `apps/web/src/types/api.ts`, extend the `PermissionKey` union (add two lines before the closing `;` of the union starting at line 16):

```typescript
  | "project-checklists:read"
  | "project-checklists:write";
```

(remove the trailing `;` from the previous last line `"settings:manage";` and move it here — the union stays a single statement.)

Append at the end of the file:

```typescript
export type ProjectChecklistType = "INSTITUTIONAL" | "SYSTEM";
export type ProjectChecklistPhaseStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE";

export interface ProjectChecklistPhase {
  id: string;
  projectChecklistId: string;
  phaseNumber: number;
  phaseName: string;
  status: ProjectChecklistPhaseStatus;
  naNote: string | null;
  updatedAt: string;
}

export interface ProjectChecklist {
  id: string;
  organizationId: string;
  name: string;
  type: ProjectChecklistType;
  companyId: string | null;
  localFolder: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectChecklistSummary extends ProjectChecklist {
  progressPercent: number;
}

export interface ProjectChecklistDetail extends ProjectChecklist {
  phases: ProjectChecklistPhase[];
}
```

- [ ] **Step 2: Write the frontend service**

Create `apps/web/src/services/project-checklists.ts`:

```typescript
import { api } from "./api-client";
import type {
  ProjectChecklistDetail,
  ProjectChecklistPhase,
  ProjectChecklistPhaseStatus,
  ProjectChecklistSummary,
  ProjectChecklistType,
} from "@/types/api";

export interface CreateProjectChecklistPayload {
  name: string;
  type: ProjectChecklistType;
  companyId?: string;
  localFolder?: string;
}

export interface UpdatePhaseStatusPayload {
  status: ProjectChecklistPhaseStatus;
  naNote?: string;
}

export const projectChecklistsService = {
  list: () => api.get<ProjectChecklistSummary[]>("/api/v1/project-checklists"),

  get: (id: string) => api.get<ProjectChecklistDetail>(`/api/v1/project-checklists/${id}`),

  create: (payload: CreateProjectChecklistPayload) =>
    api.post<ProjectChecklistDetail>("/api/v1/project-checklists", payload),

  delete: (id: string) => api.delete<void>(`/api/v1/project-checklists/${id}`),

  updatePhaseStatus: (id: string, phaseNumber: number, payload: UpdatePhaseStatusPayload) =>
    api.patch<ProjectChecklistPhase>(`/api/v1/project-checklists/${id}/phases/${phaseNumber}`, payload),
};
```

- [ ] **Step 3: Add query keys**

In `apps/web/src/lib/query-keys.ts`, add to the `queryKeys` object (alongside `leads`):

```typescript
  projectChecklists: {
    list: () => ["project-checklists", "list"] as const,
    detail: (id: string) => ["project-checklists", "detail", id] as const,
  },
```

- [ ] **Step 4: Write the hooks**

Create `apps/web/src/features/project-checklists/hooks.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  projectChecklistsService,
  type CreateProjectChecklistPayload,
  type UpdatePhaseStatusPayload,
} from "@/services/project-checklists";

export function useProjectChecklists() {
  return useQuery({
    queryKey: queryKeys.projectChecklists.list(),
    queryFn: () => projectChecklistsService.list(),
  });
}

export function useProjectChecklist(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projectChecklists.detail(id ?? ""),
    queryFn: () => projectChecklistsService.get(id!),
    enabled: !!id,
  });
}

export function useCreateProjectChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectChecklistPayload) => projectChecklistsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", "list"] });
      toast.success("Projeto criado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao criar projeto."),
  });
}

export function useUpdatePhaseStatus(checklistId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      phaseNumber,
      payload,
    }: {
      phaseNumber: number;
      payload: UpdatePhaseStatusPayload;
    }) => projectChecklistsService.updatePhaseStatus(checklistId, phaseNumber, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectChecklists.detail(checklistId) });
      queryClient.invalidateQueries({ queryKey: ["project-checklists", "list"] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar fase."),
  });
}

export function useDeleteProjectChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectChecklistsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-checklists", "list"] });
      toast.success("Projeto removido.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover projeto."),
  });
}
```

- [ ] **Step 5: Add the nav item**

In `apps/web/src/components/shell/nav-items.ts`:

Add `FolderKanban` (or another unused `lucide-react` icon — check the existing import list doesn't already have a suitable one before adding a new import) to the icon import list.

Add a new item to the `"Interno"` section's `items` array (before the `MilSocial` entry), so it's visible to Rick and anyone with the permission, not owner-only:

```typescript
      {
        label: "Projetos",
        href: "/projetos",
        icon: FolderKanban,
        permission: "project-checklists:read",
      },
```

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @millead/web type-check`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/types/api.ts apps/web/src/services/project-checklists.ts apps/web/src/lib/query-keys.ts apps/web/src/features/project-checklists/hooks.ts apps/web/src/components/shell/nav-items.ts
git commit -m "feat(web): add project-checklist data layer and nav entry"
```

---

### Task 9: Frontend — list page and create dialog

**Files:**
- Create: `apps/web/src/features/project-checklists/components/create-project-checklist-dialog.tsx`
- Create: `apps/web/src/app/(app)/projetos/page.tsx`

**Interfaces:**
- Consumes: `useProjectChecklists`, `useCreateProjectChecklist` (Task 8); `Progress` (`apps/web/src/components/ui/progress.tsx`), `Badge` (`apps/web/src/components/ui/badge.tsx`), `Dialog*`/`Select*`/`Input`/`Label`/`Button`/`Card` (existing shadcn components); `ErrorState` (`apps/web/src/components/error-state.tsx`, existing).
- Produces: page at route `/projetos` — consumed by users navigating via the nav item added in Task 8; no other task depends on this file's exports.

- [ ] **Step 1: Write the create dialog**

Create `apps/web/src/features/project-checklists/components/create-project-checklist-dialog.tsx`:

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateProjectChecklist } from "@/features/project-checklists/hooks";

const schema = z.object({
  name: z.string().min(1, "Informe um nome."),
  type: z.enum(["INSTITUTIONAL", "SYSTEM"]),
  localFolder: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateProjectChecklistDialog() {
  const [open, setOpen] = useState(false);
  const createProjectChecklist = useCreateProjectChecklist();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "INSTITUTIONAL" },
  });

  async function onSubmit(values: FormValues) {
    await createProjectChecklist.mutateAsync({
      name: values.name,
      type: values.type,
      localFolder: values.localFolder || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              Cria o checklist já com as 16 fases do tipo escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" placeholder="Ex.: Kavita Drones — Landing" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTITUTIONAL">Institucional / Landing</SelectItem>
                      <SelectItem value="SYSTEM">Sistema (banco + backend + frontend)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="localFolder">Pasta local (opcional)</Label>
              <Input
                id="localFolder"
                placeholder="Ex.: kavita-drones-landing"
                {...register("localFolder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createProjectChecklist.isPending}>
              {createProjectChecklist.isPending ? "Criando…" : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write the list page**

Create `apps/web/src/app/(app)/projetos/page.tsx`:

```typescript
"use client";

import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CreateProjectChecklistDialog } from "@/features/project-checklists/components/create-project-checklist-dialog";
import { useProjectChecklists } from "@/features/project-checklists/hooks";

const TYPE_LABELS = {
  INSTITUTIONAL: "Institucional / Landing",
  SYSTEM: "Sistema",
} as const;

export default function ProjectChecklistsPage() {
  const { data, isLoading, isError, refetch } = useProjectChecklists();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.length} projeto${data.length === 1 ? "" : "s"}` : "Carregando…"}
          </p>
        </div>
        <CreateProjectChecklistDialog />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : data && data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto ainda. Crie o primeiro com o botão acima.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((project) => (
            <Link key={project.id} href={`/projetos/${project.id}`}>
              <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium">{project.name}</h2>
                  <Badge variant="secondary">{TYPE_LABELS[project.type]}</Badge>
                </div>
                <Progress value={project.progressPercent} />
                <p className="text-xs text-muted-foreground">{project.progressPercent}% concluído</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @millead/web type-check`
Expected: exits 0.

- [ ] **Step 4: Manual check in the browser**

Run `pnpm dev:web` (with `pnpm dev:api` still running from Task 7), log in, navigate to `/projetos`. Expected: page loads, shows the empty state (or the smoke-test project if Task 7's Step 6 wasn't cleaned up), "Novo projeto" dialog opens and creates a project that appears in the grid with a 0% progress bar.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/features/project-checklists/components/create-project-checklist-dialog.tsx" "apps/web/src/app/(app)/projetos/page.tsx"
git commit -m "feat(web): add project-checklists list page and create dialog"
```

---

### Task 10: Frontend — detail page with phase editor

**Files:**
- Create: `apps/web/src/features/project-checklists/components/phase-status-select.tsx`
- Create: `apps/web/src/app/(app)/projetos/[id]/page.tsx`

**Interfaces:**
- Consumes: `useProjectChecklist`, `useUpdatePhaseStatus` (Task 8); `Select*`, `Textarea`, `Badge` (existing shadcn components).
- Produces: page at route `/projetos/[id]` — linked from Task 9's list page; no other task depends on this file's exports.

- [ ] **Step 1: Write the phase status selector**

Create `apps/web/src/features/project-checklists/components/phase-status-select.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdatePhaseStatus } from "@/features/project-checklists/hooks";
import type { ProjectChecklistPhase, ProjectChecklistPhaseStatus } from "@/types/api";

const STATUS_LABELS: Record<ProjectChecklistPhaseStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  NOT_APPLICABLE: "N/A",
};

const STATUS_VARIANTS: Record<
  ProjectChecklistPhaseStatus,
  "outline" | "warning" | "success" | "secondary"
> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "warning",
  DONE: "success",
  NOT_APPLICABLE: "secondary",
};

export function PhaseStatusSelect({
  checklistId,
  phase,
}: {
  checklistId: string;
  phase: ProjectChecklistPhase;
}) {
  const updatePhaseStatus = useUpdatePhaseStatus(checklistId);
  const [pendingStatus, setPendingStatus] = useState<ProjectChecklistPhaseStatus | null>(null);
  const [naNote, setNaNote] = useState(phase.naNote ?? "");

  function commit(status: ProjectChecklistPhaseStatus, note?: string) {
    updatePhaseStatus.mutate({ phaseNumber: phase.phaseNumber, payload: { status, naNote: note } });
    setPendingStatus(null);
  }

  function handleChange(next: ProjectChecklistPhaseStatus) {
    if (next === "NOT_APPLICABLE") {
      // N/A exige nota -- abre o campo em vez de gravar direto (a API rejeita sem naNote).
      setPendingStatus(next);
      return;
    }
    commit(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={phase.status} onValueChange={handleChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as ProjectChecklistPhaseStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={STATUS_VARIANTS[phase.status]}>{STATUS_LABELS[phase.status]}</Badge>
      </div>

      {phase.status === "NOT_APPLICABLE" && phase.naNote && pendingStatus !== "NOT_APPLICABLE" && (
        <p className="text-xs text-muted-foreground">N/A — {phase.naNote}</p>
      )}

      {pendingStatus === "NOT_APPLICABLE" && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            placeholder="Motivo (obrigatório para marcar N/A)"
            value={naNote}
            onChange={(e) => setNaNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!naNote.trim() || updatePhaseStatus.isPending}
              onClick={() => commit("NOT_APPLICABLE", naNote.trim())}
            >
              Salvar N/A
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingStatus(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the detail page**

Create `apps/web/src/app/(app)/projetos/[id]/page.tsx`:

```typescript
"use client";

import { useParams } from "next/navigation";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PhaseStatusSelect } from "@/features/project-checklists/components/phase-status-select";
import { useProjectChecklist } from "@/features/project-checklists/hooks";

const TYPE_LABELS = {
  INSTITUTIONAL: "Institucional / Landing",
  SYSTEM: "Sistema",
} as const;

export default function ProjectChecklistDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useProjectChecklist(params.id);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const doneCount = data.phases.filter(
    (p) => p.status === "DONE" || p.status === "NOT_APPLICABLE",
  ).length;
  const progressPercent = Math.round((doneCount / data.phases.length) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <Badge variant="secondary">{TYPE_LABELS[data.type]}</Badge>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={progressPercent} className="max-w-xs" />
          <span className="text-sm text-muted-foreground">{progressPercent}%</span>
        </div>
      </div>

      <Card className="divide-y p-0">
        {data.phases.map((phase) => (
          <div key={phase.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium">
                Fase {String(phase.phaseNumber).padStart(2, "0")} — {phase.phaseName}
              </p>
            </div>
            <PhaseStatusSelect checklistId={data.id} phase={phase} />
          </div>
        ))}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter @millead/web type-check`
Expected: exits 0.

- [ ] **Step 4: Manual check in the browser**

With `pnpm dev:api`/`pnpm dev:web` running, open a project created in Task 9's manual check, click through to its detail page. Expected: 16 phases listed 1-16 with the correct names for the chosen type, changing a phase's status to anything except N/A saves immediately (progress bar updates), changing to N/A opens the note field and blocks saving until a note is typed, and after saving N/A the note shows under the phase.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/features/project-checklists/components/phase-status-select.tsx" "apps/web/src/app/(app)/projetos/[id]/page.tsx"
git commit -m "feat(web): add project-checklist detail page with phase editor"
```
