"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateTaskDialog } from "@/features/tasks/components/create-task-dialog";
import { TasksList } from "@/features/tasks/components/tasks-list";
import { useTasks } from "@/features/tasks/hooks";
import { TASK_STATUS_LABELS } from "@/features/tasks/task-labels";
import type { TaskStatus } from "@/types/api";
import { useTeamDirectory } from "@/features/team/hooks";
import { useAuthStore } from "@/stores/auth-store";

/** Conteúdo completo do módulo de tarefas (filtros + lista + paginação),
 * sem o cabeçalho de página -- vive como tab da Agenda (auditoria de UX
 * 07/2026), mas continua utilizável standalone. */
export function TasksPanel() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  // Estado inicial só: lido uma vez da URL (ex.: dashboard linka
  // /tasks?overdue=true) -- depois disso o toggle manda, sem reagir a
  // mudanças posteriores no searchParams.
  const [overdueOnly, setOverdueOnly] = useState(() => searchParams.get("overdue") === "true");
  const [assigneeId, setAssigneeId] = useState<string | "ALL">("ALL");
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: members = [] } = useTeamDirectory();
  const memberNameById = new Map(members.map((member) => [member.userId, member.name]));

  const { data, isLoading, isError, refetch } = useTasks({
    page,
    pageSize: 20,
    status: status === "ALL" ? undefined : status,
    overdue: overdueOnly || undefined,
    assigneeId: assigneeId === "ALL" ? undefined : assigneeId,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as TaskStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assigneeId}
          onValueChange={(value) => {
            setAssigneeId(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os responsáveis</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.userId === currentUserId ? "Minhas tarefas (Você)" : member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => {
            setOverdueOnly((v) => !v);
            setPage(1);
          }}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            overdueOnly
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          Atrasadas
        </button>
        <div className="ml-auto">
          <CreateTaskDialog />
        </div>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Card className="p-4">
          <TasksList
            tasks={data?.items ?? []}
            isLoading={isLoading}
            memberNameById={memberNameById}
          />
        </Card>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
