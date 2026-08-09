"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/utils/format";
import { useOverdueTasksList } from "../hooks";

/** Igual a UpcomingTasksCard, mas com acento de alerta -- é a lista que
 * chama atenção pra o que já passou do prazo, não pra o que ainda vem. */
export function OverdueTasksCard() {
  const { data, isLoading } = useOverdueTasksList();
  const hasOverdue = (data?.items.length ?? 0) > 0;

  return (
    <Card className={hasOverdue ? "border-destructive/40" : undefined}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Tarefas atrasadas
        </CardTitle>
        <Link
          href="/tasks?overdue=true"
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Nenhuma tarefa atrasada"
            description="Tudo em dia."
            className="border-none py-8"
          />
        ) : (
          data.items.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <p className="truncate text-sm">{task.title}</p>
              {task.dueAt && (
                <Badge variant="destructive" className="shrink-0">
                  {formatDate(task.dueAt)}
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
