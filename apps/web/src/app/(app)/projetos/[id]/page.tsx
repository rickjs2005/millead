"use client";

import { ArrowLeft, FolderKanban } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PhaseStatusSelect } from "@/features/project-checklists/components/phase-status-select";
import { useProjectChecklist } from "@/features/project-checklists/hooks";
import { ApiError } from "@/services/api-client";

const TYPE_LABELS = {
  INSTITUTIONAL: "Institucional / Landing",
  SYSTEM: "Sistema",
} as const;

export default function ProjectChecklistDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useProjectChecklist(params.id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // A API distingue 404 real (checklist inexistente ou de outra org) de
  // outros erros via ApiError.status -- só nesse caso "não encontrado" é a
  // mensagem certa. Qualquer outro erro (rede, 5xx, 403) é transitório ou
  // não tem "voltar pra lista" como solução: ErrorState com retry.
  if (isError || !data) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          icon={FolderKanban}
          title="Projeto não encontrado"
          description="Ele pode ter sido removido, ou o link está errado."
          action={
            <Link
              href="/projetos"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar para Projetos
            </Link>
          }
        />
      );
    }
    return <ErrorState onRetry={() => refetch()} className="py-20" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          <Badge variant="secondary">{TYPE_LABELS[data.type]}</Badge>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={data.progressPercent} className="max-w-xs" />
          <span className="text-sm text-muted-foreground">{data.progressPercent}%</span>
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
