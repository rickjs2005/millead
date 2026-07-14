"use client";

import { CheckSquare, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDeleteTask, useUpdateTask } from "@/features/tasks/hooks";
import { TASK_STATUS_LABELS, TASK_STATUS_VARIANT } from "@/features/tasks/task-labels";
import { formatDate } from "@/utils/format";
import type { Task } from "@/types/api";

function TaskRow({ task }: { task: Task }) {
  const updateTask = useUpdateTask(task.id);
  const deleteTask = useDeleteTask();
  const overdue = task.dueAt && task.status === "PENDING" && new Date(task.dueAt) < new Date();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Checkbox
        checked={task.status === "DONE"}
        onCheckedChange={(checked) => updateTask.mutate({ status: checked ? "DONE" : "PENDING" })}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${task.status === "DONE" ? "text-muted-foreground line-through" : ""}`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="truncate text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>
      {task.dueAt && (
        <Badge variant={overdue ? "destructive" : "outline"}>{formatDate(task.dueAt)}</Badge>
      )}
      <Badge variant={TASK_STATUS_VARIANT[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => deleteTask.mutate(task.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function TasksList({ tasks, isLoading }: { tasks: Task[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return <EmptyState icon={CheckSquare} title="Nenhuma tarefa encontrada" className="py-16" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
