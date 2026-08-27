"use client";

import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { deadlineLabel, selectProjectDeadlines } from "@/features/dashboard/project-deadlines";
import { useProjectChecklists } from "@/features/project-checklists/hooks";

const MAX_ITEMS = 5;

/**
 * Projetos com prazo estourado ou perto de estourar. O prazo vem do contrato
 * assinado (`assinadoEm + prazoEntregaDias`, gravado pela automação
 * pós-fechamento) -- antes desta tela ele existia no banco e não aparecia em
 * lugar nenhum.
 *
 * Filtra no cliente de propósito: `GET /project-checklists` já devolve a
 * lista inteira sem paginação, então um endpoint novo só pra isso seria
 * cerimônia. Se um dia a lista crescer a ponto de doer, aí sim vale o
 * endpoint -- e a regra já está isolada em `selectProjectDeadlines`.
 */
export function ProjectDeadlinesCard() {
  const { data, isLoading } = useProjectChecklists();
  const deadlines = selectProjectDeadlines(data ?? [], new Date()).slice(0, MAX_ITEMS);
  const hasOverdue = deadlines.some((d) => d.overdue);

  return (
    <Card className={hasOverdue ? "border-destructive/40" : undefined}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className={`h-4 w-4 ${hasOverdue ? "text-destructive" : ""}`} />
          Prazos de projeto
        </CardTitle>
        <Link href="/projetos" className="text-xs font-medium text-primary hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : deadlines.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nenhum prazo apertado"
            description="Nenhum projeto vence nas próximas duas semanas."
            className="border-none py-8"
          />
        ) : (
          deadlines.map(({ project, daysLeft, overdue }) => (
            <Link
              key={project.id}
              href={`/projetos/${project.id}`}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-sm">{project.name}</p>
                <Progress value={project.progressPercent} className="h-1" />
              </div>
              <Badge variant={overdue ? "destructive" : "secondary"} className="shrink-0">
                {deadlineLabel(daysLeft)}
              </Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
