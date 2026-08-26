import { describe, expect, it, vi } from "vitest";
import { ValidationError } from "../../domain/errors/app-error.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";
import type { TaskRepository } from "../../domain/repositories/task-repository.js";
import type { ActivityLogger } from "./activity-logger.js";
import { LeadService } from "./lead-service.js";
import { TaskService } from "./task-service.js";

function rejectingMemberships(): MembershipRepository {
  return {
    isActiveMember: vi.fn().mockResolvedValue(false),
  } as unknown as MembershipRepository;
}

describe("validação multi-tenant de responsáveis", () => {
  it("LeadService rejeita owner que não é membro ativo da organização", async () => {
    const leads = { create: vi.fn() } as unknown as LeadRepository;
    const service = new LeadService(
      leads,
      {} as PipelineRepository,
      {} as ActivityLogger,
      rejectingMemberships(),
    );

    await expect(
      service.create("org-1", "actor-1", { title: "Lead", ownerId: "user-de-outra-org" }),
    ).rejects.toThrow(ValidationError);
    expect(leads.create).not.toHaveBeenCalled();
  });

  it("TaskService rejeita assignee que não é membro ativo da organização", async () => {
    const tasks = { create: vi.fn() } as unknown as TaskRepository;
    const service = new TaskService(tasks, rejectingMemberships());

    await expect(
      service.create("org-1", { title: "Tarefa", assigneeId: "user-de-outra-org" }),
    ).rejects.toThrow(ValidationError);
    expect(tasks.create).not.toHaveBeenCalled();
  });
});
