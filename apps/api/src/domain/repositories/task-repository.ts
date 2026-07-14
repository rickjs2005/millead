import type { TaskStatus } from "@millead/database";
import type { Task } from "../entities/task.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateTaskInput {
  organizationId: string;
  leadId?: string | null;
  assigneeId?: string | null;
  title: string;
  description?: string | null;
  dueAt?: Date | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  dueAt?: Date | null;
  status?: TaskStatus;
  completedAt?: Date | null;
}

export interface TaskFilters {
  leadId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  /** Só tarefas PENDING com dueAt no passado. */
  overdue?: boolean;
}

export interface TaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  findByIdForOrg(id: string, organizationId: string): Promise<Task | null>;
  list(
    organizationId: string,
    filters: TaskFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Task>>;
  update(id: string, organizationId: string, patch: UpdateTaskInput): Promise<Task | null>;
  delete(id: string, organizationId: string): Promise<boolean>;
}
