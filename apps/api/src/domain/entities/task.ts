import type { TaskStatus } from "@millead/database";

export interface Task {
  id: string;
  organizationId: string;
  leadId: string | null;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
