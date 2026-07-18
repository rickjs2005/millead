"use client";

import {
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  Handshake,
  ShieldAlert,
  Users2,
} from "lucide-react";
import { LeadStatusChart } from "@/features/dashboard/components/lead-status-chart";
import { OnboardingChecklist } from "@/features/dashboard/components/onboarding-checklist";
import { PipelineFunnelChart } from "@/features/dashboard/components/pipeline-funnel-chart";
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
  const showOnboarding = dataReady && (!hasPipeline || !hasLeads);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Aqui está o panorama da sua operação hoje.</p>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de leads"
          value={counts.totalLeads}
          icon={Users2}
          loading={counts.isLoading}
        />
        <StatCard
          label="Leads abertos"
          value={counts.openLeads}
          icon={ClipboardCheck}
          loading={counts.isLoading}
        />
        <StatCard
          label="Leads ganhos"
          value={counts.wonLeads}
          icon={Handshake}
          loading={counts.isLoading}
          accent="success"
        />
        <StatCard
          label="Tarefas atrasadas"
          value={counts.overdueTasks}
          icon={ShieldAlert}
          loading={counts.isLoading}
          accent={counts.overdueTasks > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Tarefas pendentes"
          value={counts.pendingTasks}
          icon={CheckSquare}
          loading={counts.isLoading}
        />
        <StatCard
          label="Reuniões agendadas"
          value={counts.scheduledMeetings}
          icon={CalendarCheck}
          loading={counts.isLoading}
        />
        <StatCard
          label="Propostas enviadas"
          value={counts.sentProposals}
          icon={Handshake}
          loading={counts.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineFunnelChart />
        <LeadStatusChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingTasksCard />
        <UpcomingMeetingsCard />
      </div>
    </div>
  );
}
