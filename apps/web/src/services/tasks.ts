import { api } from "./api-client";
import type { PaginatedResult, Task, TaskStatus } from "@/types/api";

export interface CreateTaskPayload {
  title: string;
  description?: string;
  leadId?: string;
  assigneeId?: string;
  dueAt?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  status?: TaskStatus;
}

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  leadId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  overdue?: boolean;
}

export const tasksService = {
  list: (params: ListTasksParams = {}) => api.get<PaginatedResult<Task>>("/api/v1/tasks", params),
  get: (id: string) => api.get<Task>(`/api/v1/tasks/${id}`),
  create: (payload: CreateTaskPayload) => api.post<Task>("/api/v1/tasks", payload),
  update: (id: string, payload: UpdateTaskPayload) =>
    api.patch<Task>(`/api/v1/tasks/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/tasks/${id}`),
};
