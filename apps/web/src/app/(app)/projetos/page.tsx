"use client";

import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CreateProjectChecklistDialog } from "@/features/project-checklists/components/create-project-checklist-dialog";
import { useProjectChecklists } from "@/features/project-checklists/hooks";

const TYPE_LABELS = {
  INSTITUTIONAL: "Institucional / Landing",
  SYSTEM: "Sistema",
} as const;

export default function ProjectChecklistsPage() {
  const { data, isLoading, isError, refetch } = useProjectChecklists();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.length} projeto${data.length === 1 ? "" : "s"}` : "Carregando…"}
          </p>
        </div>
        <CreateProjectChecklistDialog />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : data && data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto ainda. Crie o primeiro com o botão acima.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((project) => (
            <Link key={project.id} href={`/projetos/${project.id}`}>
              <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-primary/40">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium">{project.name}</h2>
                  <Badge variant="secondary">{TYPE_LABELS[project.type]}</Badge>
                </div>
                <Progress value={project.progressPercent} />
                <p className="text-xs text-muted-foreground">{project.progressPercent}% concluído</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
