"use client";

import {
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  Handshake,
  ShieldAlert,
  FileText,
  Users2,
} from "lucide-react";
import { CostSummaryTiles } from "@/features/dashboard/components/cost-summary-tiles";
import { FinanceCards } from "@/features/dashboard/components/finance-cards";
import { LeadStatusChart } from "@/features/dashboard/components/lead-status-chart";
import { OnboardingChecklist } from "@/features/dashboard/components/onboarding-checklist";
import { OverdueTasksCard } from "@/features/dashboard/components/overdue-tasks-card";
import { PipelineFunnelChart } from "@/features/dashboard/components/pipeline-funnel-chart";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { RecentActivitiesCard } from "@/features/dashboard/components/recent-activities-card";
import { RevenueCostChart } from "@/features/dashboard/components/revenue-cost-chart";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { UpcomingMeetingsCard } from "@/features/dashboard/components/upcoming-meetings-card";
import { UpcomingTasksCard } from "@/features/dashboard/components/upcoming-tasks-card";
import { useDashboardCounts } from "@/features/dashboard/hooks";
import { usePipelines } from "@/features/pipeline/hooks";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const counts = useDashboardCounts();
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const firstName = user?.name.split(" ")[0];

  const hasPipeline = (pipelines ?? []).some((p) => p.stages.length > 0);
  const hasLeads = counts.totalLeads > 0;
  const dataReady = !counts.isLoading && !pipelinesLoading;
  // Se a contagem de leads falhou, `hasLeads` (calculado do fallback `?? 0`)
  // não é confiável -- não dá pra concluir "sem leads ainda" de um erro de
  // rede, então não força o checklist de onboarding nesse caso.
  const showOnboarding = dataReady && !counts.totalLeadsError && (!hasPipeline || !hasLeads);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o panorama da sua operação hoje.
          </p>
        </div>
        <QuickActions />
      </div>

      {showOnboarding && (
        <OnboardingChecklist
          steps={[
            {
              label: "Configure seu pipeline",
              description: "Defina os estágios que um lead percorre (é o que monta o kanban).",
              href: "/settings/pipeline",
              done: hasPipeline,
            },
            {
              label: "Crie seu primeiro lead",
              description: "Cadastre uma oportunidade e acompanhe pelo funil.",
              href: "/leads",
              done: hasLeads,
            },
            {
              label: "Envie um briefing",
              description: "Gere um link para o cliente preencher o projeto dele.",
              href: "/briefings",
              done: false,
            },
          ]}
        />
      )}

      <RevenueCostChart />

      <FinanceCards />

      <CostSummaryTiles />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de leads"
          value={counts.totalLeadsError ? "—" : counts.totalLeads}
          icon={Users2}
          loading={counts.isLoading}
        />
        <StatCard
          label="Leads abertos"
          value={counts.openLeadsError ? "—" : counts.openLeads}
          icon={ClipboardCheck}
          loading={counts.isLoading}
        />
        <StatCard
          label="Leads ganhos"
          value={counts.wonLeadsError ? "—" : counts.wonLeads}
          icon={Handshake}
          loading={counts.isLoading}
          accent="success"
        />
        <StatCard
          label="Tarefas atrasadas"
          value={counts.overdueTasksError ? "—" : counts.overdueTasks}
          icon={ShieldAlert}
          loading={counts.isLoading}
          accent={!counts.overdueTasksError && counts.overdueTasks > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Tarefas pendentes"
          value={counts.pendingTasksError ? "—" : counts.pendingTasks}
          icon={CheckSquare}
          loading={counts.isLoading}
        />
        <StatCard
          label="Reuniões agendadas"
          value={counts.scheduledMeetingsError ? "—" : counts.scheduledMeetings}
          icon={CalendarCheck}
          loading={counts.isLoading}
        />
        <StatCard
          label="Propostas enviadas"
          value={counts.sentProposalsError ? "—" : counts.sentProposals}
          icon={Handshake}
          loading={counts.isLoading}
        />
        <StatCard
          label="Briefings aguardando cliente"
          value={counts.openBriefingsError ? "—" : counts.openBriefings}
          icon={FileText}
          loading={counts.isLoading}
          accent={!counts.openBriefingsError && counts.openBriefings > 0 ? "success" : "default"}
        />
        <StatCard
          label="Briefings concluídos"
          value={counts.completedBriefingsError ? "—" : counts.completedBriefings}
          icon={ClipboardCheck}
          loading={counts.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineFunnelChart />
        <LeadStatusChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UpcomingTasksCard />
        <OverdueTasksCard />
        <UpcomingMeetingsCard />
      </div>

      <RecentActivitiesCard />
    </div>
  );
}
