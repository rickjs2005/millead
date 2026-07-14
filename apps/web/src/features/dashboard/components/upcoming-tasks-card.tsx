"use client";

import { CheckSquare } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/utils/format";
import { useUpcomingTasks } from "../hooks";

export function UpcomingTasksCard() {
  const { data, isLoading } = useUpcomingTasks();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Próximas tarefas</CardTitle>
        <Link href="/tasks" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nenhuma tarefa pendente"
            description="Você está em dia."
            className="border-none py-8"
          />
        ) : (
          data.items.map((task) => {
            const overdue = task.dueAt && new Date(task.dueAt) < new Date();
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
              >
                <p className="truncate text-sm">{task.title}</p>
                {task.dueAt && (
                  <Badge variant={overdue ? "destructive" : "outline"} className="shrink-0">
                    {formatDate(task.dueAt)}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
