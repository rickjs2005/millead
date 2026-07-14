import type { TaskStatus } from "@/types/api";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendente",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export const TASK_STATUS_VARIANT: Record<TaskStatus, "default" | "success" | "secondary"> = {
  PENDING: "default",
  DONE: "success",
  CANCELLED: "secondary",
};
