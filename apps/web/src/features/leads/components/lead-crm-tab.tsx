"use client";

import { CalendarCheck, CheckSquare, Handshake, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateMeetingDialog } from "@/features/meetings/components/create-meeting-dialog";
import { useMeetings } from "@/features/meetings/hooks";
import { CreateProposalDialog } from "@/features/proposals/components/create-proposal-dialog";
import { useProposals } from "@/features/proposals/hooks";
import { CreateTaskDialog } from "@/features/tasks/components/create-task-dialog";
import { useTasks } from "@/features/tasks/hooks";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/format";

function SectionCard({
  title,
  icon: Icon,
  isLoading,
  isEmpty,
  emptyLabel,
  action,
  children,
}: {
  title: string;
  icon: typeof CheckSquare;
  isLoading: boolean;
  isEmpty: boolean;
  emptyLabel: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : isEmpty ? (
          <EmptyState icon={Icon} title={emptyLabel} className="border-none py-8" />
        ) : (
          <div className="flex flex-col gap-2">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

/** Antes cada seção tinha um dialog "Quick" próprio duplicando o formulário
 * global -- agora reusa os dialogs de criação globais pré-vinculados ao lead
 * (auditoria de UX 07/2026). */
export function LeadCrmTab({ leadId }: { leadId: string }) {
  const tasks = useTasks({ leadId, pageSize: 10 });
  const meetings = useMeetings({ leadId, pageSize: 10 });
  const proposals = useProposals({ leadId, pageSize: 10 });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <SectionCard
        title="Tarefas"
        icon={CheckSquare}
        isLoading={tasks.isLoading}
        isEmpty={!tasks.data || tasks.data.items.length === 0}
        emptyLabel="Nenhuma tarefa"
        action={
          <CreateTaskDialog
            leadId={leadId}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Tarefa
              </Button>
            }
          />
        }
      >
        {tasks.data?.items.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
          >
            <span className="truncate">{task.title}</span>
            {task.dueAt && <Badge variant="outline">{formatDate(task.dueAt)}</Badge>}
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Reuniões"
        icon={CalendarCheck}
        isLoading={meetings.isLoading}
        isEmpty={!meetings.data || meetings.data.items.length === 0}
        emptyLabel="Nenhuma reunião"
        action={
          <CreateMeetingDialog
            leadId={leadId}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Reunião
              </Button>
            }
          />
        }
      >
        {meetings.data?.items.map((meeting) => (
          <div
            key={meeting.id}
            className="flex flex-col gap-0.5 rounded-lg border border-border p-2.5 text-sm"
          >
            <span className="truncate font-medium">{meeting.title}</span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(meeting.scheduledAt)}
            </span>
          </div>
        ))}
      </SectionCard>

      <SectionCard
        title="Propostas"
        icon={Handshake}
        isLoading={proposals.isLoading}
        isEmpty={!proposals.data || proposals.data.items.length === 0}
        emptyLabel="Nenhuma proposta"
        action={
          <CreateProposalDialog
            leadId={leadId}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Proposta
              </Button>
            }
          />
        }
      >
        {proposals.data?.items.map((proposal) => (
          <div
            key={proposal.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
          >
            <span className="truncate">{proposal.title}</span>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(proposal.value, proposal.currency)}
            </span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
