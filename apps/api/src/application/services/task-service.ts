import { NotFoundError } from "../../domain/errors/app-error.js";
import type {
  TaskFilters,
  TaskRepository,
  UpdateTaskInput,
} from "../../domain/repositories/task-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { CreateTaskInput } from "../dto/task.dto.js";

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  create(organizationId: string, input: CreateTaskInput) {
    return this.repository.create({ organizationId, ...input });
  }

  async get(organizationId: string, id: string) {
    const task = await this.repository.findByIdForOrg(id, organizationId);
    if (!task) throw new NotFoundError("Tarefa não encontrada.");
    return task;
  }

  list(organizationId: string, filters: TaskFilters, pagination: PaginationParams) {
    return this.repository.list(organizationId, filters, pagination);
  }

  async update(organizationId: string, id: string, patch: UpdateTaskInput) {
    // Marcar DONE sem `completedAt` explícito preenche com agora;
    // sair de DONE (reabrir a tarefa) limpa o campo.
    const resolvedPatch: UpdateTaskInput = { ...patch };
    if (patch.status === "DONE" && resolvedPatch.completedAt === undefined) {
      resolvedPatch.completedAt = new Date();
    } else if (patch.status && patch.status !== "DONE") {
      resolvedPatch.completedAt = null;
    }

    const task = await this.repository.update(id, organizationId, resolvedPatch);
    if (!task) throw new NotFoundError("Tarefa não encontrada.");
    return task;
  }

  async delete(organizationId: string, id: string) {
    const deleted = await this.repository.delete(id, organizationId);
    if (!deleted) throw new NotFoundError("Tarefa não encontrada.");
  }
}
