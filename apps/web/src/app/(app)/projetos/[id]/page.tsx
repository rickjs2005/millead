"use client";

import { useParams } from "next/navigation";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PhaseStatusSelect } from "@/features/project-checklists/components/phase-status-select";
import { useProjectChecklist } from "@/features/project-checklists/hooks";

const TYPE_LABELS = {
  INSTITUTIONAL: "Institucional / Landing",
  SYSTEM: "Sistema",
} as const;

export default function ProjectChecklistDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useProjectChecklist(params.id);

  if (isError) return <ErrorState onRetry={() => refetch()} />;
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const doneCount = data.phases.filter(
    (p) => p.status === "DONE" || p.status === "NOT_APPLICABLE",
  ).length;
  const progressPercent = Math.round((doneCount / data.phases.length) * 100);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <Badge variant="secondary">{TYPE_LABELS[data.type]}</Badge>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={progressPercent} className="max-w-xs" />
          <span className="text-sm text-muted-foreground">{progressPercent}%</span>
        </div>
      </div>

      <Card className="divide-y p-0">
        {data.phases.map((phase) => (
          <div key={phase.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-medium">
                Fase {String(phase.phaseNumber).padStart(2, "0")} — {phase.phaseName}
              </p>
            </div>
            <PhaseStatusSelect checklistId={data.id} phase={phase} />
          </div>
        ))}
      </Card>
    </div>
  );
}
