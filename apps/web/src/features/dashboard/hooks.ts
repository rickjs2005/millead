import { useQueries, useQuery } from "@tanstack/react-query";
import { usePipelines } from "@/features/pipeline/hooks";
import { leadsService } from "@/services/leads";
import { meetingsService } from "@/services/meetings";
import { briefingsService } from "@/services/briefings";
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
      {
        queryKey: ["dashboard", "briefings", "pending"],
        queryFn: () => briefingsService.list({ status: "PENDING", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "briefings", "inprogress"],
        queryFn: () => briefingsService.list({ status: "IN_PROGRESS", pageSize: 1 }),
      },
      {
        queryKey: ["dashboard", "briefings", "completed"],
        queryFn: () => briefingsService.list({ status: "COMPLETED", pageSize: 1 }),
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
    pendingBriefings,
    inProgressBriefings,
    completedBriefings,
  ] = queries;

  return {
    isLoading: queries.some((q) => q.isLoading),
    // Cada contagem carrega o número (com fallback `?? 0` de sempre, pra não
    // quebrar consumidores existentes como `LeadStatusChart`) e um flag
    // `*Error` irmão -- os StatCards do dashboard/page.tsx que exibem
    // contagem checam o flag e trocam "0" por "—" quando a query dele (só
    // ela, não as outras 11) falhou. Precisão por métrica em vez de um
    // `isError` agregado: das 12 queries de listagem independentes, é raro
    // todas falharem juntas -- uma falhar sozinha (o caso comum) não deveria
    // apagar as outras 11 que carregaram normalmente.
    totalLeads: total.data?.total ?? 0,
    totalLeadsError: total.isError,
    openLeads: open.data?.total ?? 0,
    openLeadsError: open.isError,
    wonLeads: won.data?.total ?? 0,
    wonLeadsError: won.isError,
    lostLeads: lost.data?.total ?? 0,
    lostLeadsError: lost.isError,
    /** `LeadStatusChart` some as 3 flags acima num único `isError` pra decidir
     * entre pizza e `ErrorState` -- retry dispara as 3 queries de novo (só
     * elas, não as outras 9). */
    refetchLeadStatus: () => {
      open.refetch();
      won.refetch();
      lost.refetch();
    },
    pendingTasks: pendingTasks.data?.total ?? 0,
    pendingTasksError: pendingTasks.isError,
    overdueTasks: overdueTasks.data?.total ?? 0,
    overdueTasksError: overdueTasks.isError,
    scheduledMeetings: scheduledMeetings.data?.total ?? 0,
    scheduledMeetingsError: scheduledMeetings.isError,
    sentProposals: sentProposals.data?.total ?? 0,
    sentProposalsError: sentProposals.isError,
    acceptedProposals: acceptedProposals.data?.total ?? 0,
    acceptedProposalsError: acceptedProposals.isError,
    /** aguardando o cliente: link enviado (PENDING) ou preenchendo (IN_PROGRESS) */
    openBriefings: (pendingBriefings.data?.total ?? 0) + (inProgressBriefings.data?.total ?? 0),
    /** falha se qualquer uma das duas queries que compõem esse total falhar --
     * a soma parcial (só PENDING ou só IN_PROGRESS) seria um número real só
     * que errado, pior que "—". */
    openBriefingsError: pendingBriefings.isError || inProgressBriefings.isError,
    completedBriefings: completedBriefings.data?.total ?? 0,
    completedBriefingsError: completedBriefings.isError,
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

/** `assigneeId` alimenta o filtro "só as minhas" dos cards de tarefa. Entra
 *  na queryKey pra que alternar o toggle não sirva o cache do outro modo. */
export function useUpcomingTasks(assigneeId?: string) {
  return useQuery({
    queryKey: ["dashboard", "tasks", "upcoming", assigneeId ?? "all"],
    queryFn: () => tasksService.list({ status: "PENDING", pageSize: 5, assigneeId }),
  });
}

export function useUpcomingMeetings() {
  return useQuery({
    queryKey: ["dashboard", "meetings", "upcoming"],
    queryFn: () =>
      meetingsService.list({ status: "SCHEDULED", pageSize: 5, from: new Date().toISOString() }),
  });
}

/** Mesma contagem que `useDashboardCounts().overdueTasks` já busca, mas com
 * a LISTA (pageSize 5) pro card de "Tarefas atrasadas" do dashboard --
 * chave própria pra não colidir com a query de contagem (`pageSize: 1`). */
export function useOverdueTasksList(assigneeId?: string) {
  return useQuery({
    queryKey: ["dashboard", "tasks", "overdueList", assigneeId ?? "all"],
    queryFn: () => tasksService.list({ overdue: true, pageSize: 5, assigneeId }),
  });
}

/** Mesma queryKey do sino de notificações (components/shell/notifications-bell.tsx)
 * -- os dois consomem `GET /leads/activities/recent`, então compartilham cache
 * (React Query dedupa por key) em vez de duplicar a chamada quando ambos estão
 * montados ao mesmo tempo (sino no topbar + card no dashboard). `enabled` segue
 * o mesmo padrão do sino (`enabled: canRead`), pra não bater no endpoint sem
 * permissão. */
export function useRecentActivities(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: leadsService.recentActivities,
    enabled: options?.enabled ?? true,
  });
}
