import { useQueries, useQuery } from "@tanstack/react-query";
import { usePipelines } from "@/features/pipeline/hooks";
import { leadsService } from "@/services/leads";
import { meetingsService } from "@/services/meetings";
import { proposalsService } from "@/services/proposals";
import { tasksService } from "@/services/tasks";

/**
 * Não existe endpoint de analytics/dashboard no backend -- cada número
 * aqui vem de uma query de LISTAGEM real com `pageSize: 1`, usando só o
 * `total` da paginação. Barato (uma linha do banco por chamada) e
 * sempre correto, mas por isso o dashboard só mostra o que dá pra montar
 * assim -- nada de "leads por mês" sem um endpoint de agregação de verdade.
 */
export function useDashboardCounts() {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["dashboard", "leads", "total"],
        queryFn: () => leadsService.list({ pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "leads", "open"],
        queryFn: () => leadsService.list({ status: "OPEN", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "leads", "won"],
        queryFn: () => leadsService.list({ status: "WON", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "leads", "lost"],
        queryFn: () => leadsService.list({ status: "LOST", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "tasks", "pending"],
        queryFn: () => tasksService.list({ status: "PENDING", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "tasks", "overdue"],
        queryFn: () => tasksService.list({ overdue: true, pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "meetings", "scheduled"],
        queryFn: () => meetingsService.list({ status: "SCHEDULED", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "proposals", "sent"],
        queryFn: () => proposalsService.list({ status: "SENT", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "proposals", "accepted"],
        queryFn: () => proposalsService.list({ status: "ACCEPTED", pageSize: 1 }),
      },
    ],
  });

  const [
    total,
    open,
    won,
    lost,
    pendingTasks,
    overdueTasks,
    scheduledMeetings,
    sentProposals,
    acceptedProposals,
  ] = queries;

  return {
    isLoading: queries.some((q) => q.isLoading),
    totalLeads: total.data?.total ?? 0,
    openLeads: open.data?.total ?? 0,
    wonLeads: won.data?.total ?? 0,
    lostLeads: lost.data?.total ?? 0,
    pendingTasks: pendingTasks.data?.total ?? 0,
    overdueTasks: overdueTasks.data?.total ?? 0,
    scheduledMeetings: scheduledMeetings.data?.total ?? 0,
    sentProposals: sentProposals.data?.total ?? 0,
    acceptedProposals: acceptedProposals.data?.total ?? 0,
  };
}

export function usePipelineFunnel() {
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const defaultPipeline = pipelines?.find((p) => p.isDefault) ?? pipelines?.[0];
  const stages = defaultPipeline?.stages ?? [];

  const stageQueries = useQueries({
    queries: stages.map((stage) => ({
      queryKey: ["dashboard", "funnel", stage.id],
      queryFn: () => leadsService.list({ pipelineStageId: stage.id, pageSize: 1 }),
    })),
  });

  return {
    isLoading: pipelinesLoading || stageQueries.some((q) => q.isLoading),
    data: stages.map((stage, i) => ({
      name: stage.name,
      color: stage.color,
      count: stageQueries[i]?.data?.total ?? 0,
    })),
  };
}

export function useUpcomingTasks() {
  return useQuery({
    queryKey: ["dashboard", "tasks", "upcoming"],
    queryFn: () => tasksService.list({ status: "PENDING", pageSize: 5 }),
  });
}

export function useUpcomingMeetings() {
  return useQuery({
    queryKey: ["dashboard", "meetings", "upcoming"],
    queryFn: () =>
      meetingsService.list({ status: "SCHEDULED", pageSize: 5, from: new Date().toISOString() }),
  });
}
