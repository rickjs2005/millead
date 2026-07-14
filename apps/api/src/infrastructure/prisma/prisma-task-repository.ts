import { prisma, Prisma } from "@millead/database";
import type { Task } from "../../domain/entities/task.js";
import type {
  CreateTaskInput,
  TaskFilters,
  TaskRepository,
  UpdateTaskInput,
} from "../../domain/repositories/task-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

export class PrismaTaskRepository implements TaskRepository {
  async create(input: CreateTaskInput): Promise<Task> {
    return prisma.task.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId ?? null,
        assigneeId: input.assigneeId ?? null,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ?? null,
      },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<Task | null> {
    return prisma.task.findFirst({ where: { id, organizationId } });
  }

  async list(
    organizationId: string,
    filters: TaskFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Task>> {
    const where: Prisma.TaskWhereInput = {
      organizationId,
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.overdue ? { status: "PENDING", dueAt: { lt: new Date() } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.task.findMany({ where, orderBy: { dueAt: "asc" }, ...toSkipTake(pagination) }),
      prisma.task.count({ where }),
    ]);
    return paginate(rows, total, pagination);
  }

  async update(id: string, organizationId: string, patch: UpdateTaskInput): Promise<Task | null> {
    const { count } = await prisma.task.updateMany({ where: { id, organizationId }, data: patch });
    if (count === 0) return null;
    return prisma.task.findUniqueOrThrow({ where: { id } });
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.task.deleteMany({ where: { id, organizationId } });
    return count > 0;
  }
}
