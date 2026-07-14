"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, CheckSquare, Handshake, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateMeeting, useMeetings } from "@/features/meetings/hooks";
import { useCreateProposal, useProposals } from "@/features/proposals/hooks";
import { useCreateTask, useTasks } from "@/features/tasks/hooks";
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

function QuickTaskDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const schema = z.object({
    title: z.string().min(1, "Informe um título."),
    dueAt: z.string().optional(),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const createTask = useCreateTask();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={handleSubmit(async (values) => {
            await createTask.mutateAsync({ ...values, leadId, dueAt: values.dueAt || undefined });
            reset();
            setOpen(false);
          })}
        >
          <DialogHeader>
            <DialogTitle>Nova tarefa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-title">Título</Label>
              <Input id="task-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">Vencimento</Label>
              <Input id="task-due" type="date" {...register("dueAt")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickMeetingDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const schema = z.object({
    title: z.string().min(1, "Informe um título."),
    scheduledAt: z.string().min(1, "Informe data e hora."),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const createMeeting = useCreateMeeting();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Reunião
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={handleSubmit(async (values) => {
            await createMeeting.mutateAsync({
              title: values.title,
              leadId,
              scheduledAt: new Date(values.scheduledAt).toISOString(),
            });
            reset();
            setOpen(false);
          })}
        >
          <DialogHeader>
            <DialogTitle>Nova reunião</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-title">Título</Label>
              <Input id="meeting-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-date">Data e hora</Label>
              <Input id="meeting-date" type="datetime-local" {...register("scheduledAt")} />
              {errors.scheduledAt && (
                <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMeeting.isPending}>
              {createMeeting.isPending ? "Agendando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuickProposalDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const schema = z.object({
    title: z.string().min(1, "Informe um título."),
    value: z.string().min(1, "Informe o valor."),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });
  const createProposal = useCreateProposal();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Proposta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={handleSubmit(async (values) => {
            await createProposal.mutateAsync({ ...values, leadId });
            reset();
            setOpen(false);
          })}
        >
          <DialogHeader>
            <DialogTitle>Nova proposta</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proposal-title">Título</Label>
              <Input id="proposal-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="proposal-value">Valor (R$)</Label>
              <Input id="proposal-value" inputMode="decimal" {...register("value")} />
              {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createProposal.isPending}>
              {createProposal.isPending ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
        action={<QuickTaskDialog leadId={leadId} />}
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
        action={<QuickMeetingDialog leadId={leadId} />}
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
        action={<QuickProposalDialog leadId={leadId} />}
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
