"use client";

import {
  Banknote,
  Building2,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  Handshake,
  ShieldAlert,
  Users2,
} from "lucide-react";
import { LeadStatusChart } from "@/features/dashboard/components/lead-status-chart";
import { PipelineFunnelChart } from "@/features/dashboard/components/pipeline-funnel-chart";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { UpcomingMeetingsCard } from "@/features/dashboard/components/upcoming-meetings-card";
import { UpcomingTasksCard } from "@/features/dashboard/components/upcoming-tasks-card";
import { useDashboardCounts } from "@/features/dashboard/hooks";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const counts = useDashboardCounts();
  const firstName = user?.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Olá, {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Aqui está o panorama da sua operação hoje.</p>
      </div>

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
        <StatCard label="Receita" value="—" icon={Banknote} comingSoon />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelineFunnelChart />
        <LeadStatusChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingTasksCard />
        <UpcomingMeetingsCard />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Empresas sem site" value="—" icon={Building2} comingSoon />
        <StatCard label="Empresas com site ruim" value="—" icon={ShieldAlert} comingSoon />
        <StatCard label="Score médio" value="—" icon={ClipboardCheck} comingSoon />
        <StatCard label="Clientes ativos" value="—" icon={Users2} comingSoon />
      </div>
    </div>
  );
}
