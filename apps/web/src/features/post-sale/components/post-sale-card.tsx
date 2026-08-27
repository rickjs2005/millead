"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Loader2,
  MinusCircle,
  RefreshCw,
  Workflow,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostSaleExecution, useReprocessPostSale } from "@/features/post-sale/hooks";
import {
  artifactHref,
  AUTOMATION_ARTIFACT_LABELS,
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_STATUS_VARIANT,
  AUTOMATION_STEP_LABELS,
  AUTOMATION_STEP_STATUS_LABELS,
  canReprocess,
} from "@/features/post-sale/labels";
import { formatDateTime } from "@/utils/format";
import type { AutomationStep, AutomationStepStatus, ContractStatus } from "@/types/api";

const STEP_ICON: Record<AutomationStepStatus, ComponentType<{ className?: string }>> = {
  PENDING: CircleDashed,
  RUNNING: Loader2,
  SUCCEEDED: CheckCircle2,
  SKIPPED: MinusCircle,
  NEEDS_ACTION: AlertTriangle,
  FAILED: XCircle,
};

const STEP_TONE: Record<AutomationStepStatus, string> = {
  PENDING: "text-muted-foreground",
  RUNNING: "text-primary animate-spin",
  SUCCEEDED: "text-success",
  SKIPPED: "text-muted-foreground/50",
  NEEDS_ACTION: "text-warning",
  FAILED: "text-destructive",
};

function StepRow({ step }: { step: AutomationStep }) {
  const Icon = STEP_ICON[step.status];
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${STEP_TONE[step.status]}`} aria-hidden />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{AUTOMATION_STEP_LABELS[step.key]}</span>
          <span className="text-xs text-muted-foreground">
            {AUTOMATION_STEP_STATUS_LABELS[step.status]}
          </span>
        </div>
        {step.detail && (
          <p className="break-words text-xs text-muted-foreground">{step.detail}</p>
        )}
        {step.error && (
          <p className="break-words text-xs text-destructive">{step.error}</p>
        )}
      </div>
    </li>
  );
}

interface PostSaleCardProps {
  contractId: string;
  contractStatus: ContractStatus;
  /** Só quem pode escrever no contrato reprocessa -- a API recusa de todo
   *  jeito (proposals:write), mas esconder o botão evita um 403 previsível. */
  canWrite: boolean;
}

/**
 * Estado da automação pós-fechamento na tela do contrato: o que já rodou, o
 * que ficou pendente, o que falhou, links pro que foi criado e o botão de
 * reprocessar (que roda só as etapas que não concluíram).
 */
export function PostSaleCard({ contractId, contractStatus, canWrite }: PostSaleCardProps) {
  const { data: execution, isLoading, isError, refetch } = usePostSaleExecution(contractId);
  const reprocess = useReprocessPostSale(contractId);

  // Contrato não assinado nem tem automação a mostrar -- o card só polui.
  if (contractStatus !== "ASSINADO") return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-4 w-4" aria-hidden />
          Pós-fechamento
        </CardTitle>
        <div className="flex items-center gap-2">
          {execution && (
            <Badge variant={AUTOMATION_STATUS_VARIANT[execution.status]}>
              {AUTOMATION_STATUS_LABELS[execution.status]}
            </Badge>
          )}
          {canWrite && (!execution || canReprocess(execution.status)) && (
            <Button
              variant="outline"
              size="sm"
              disabled={reprocess.isPending}
              onClick={() => reprocess.mutate()}
            >
              <RefreshCw className={reprocess.isPending ? "animate-spin" : undefined} />
              {execution ? "Reprocessar" : "Executar agora"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        )}

        {isError && !isLoading && <ErrorState onRetry={() => refetch()} className="py-8" />}

        {!isLoading && !isError && !execution && (
          <EmptyState
            icon={Workflow}
            title="Nenhuma automação executada"
            description="Este contrato foi assinado sem a automação pós-fechamento ligada. Ative em Configurações > Automação, ou execute agora para este contrato."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/settings/automation">Abrir configurações</Link>
              </Button>
            }
          />
        )}

        {execution && (
          <>
            {execution.error && (
              <p className="rounded-lg border border-destructive/50 p-3 text-xs text-destructive">
                {execution.error}
              </p>
            )}

            <ol className="flex flex-col gap-3">
              {execution.steps.map((step) => (
                <StepRow key={step.id} step={step} />
              ))}
            </ol>

            {execution.artifacts.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Criado pela automação</p>
                <ul className="flex flex-wrap gap-2">
                  {execution.artifacts.map((artifact) => (
                    <li key={artifact.id}>
                      <Link
                        href={artifactHref(artifact.type, artifact.refId, contractId)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-accent"
                      >
                        <span className="font-medium">
                          {AUTOMATION_ARTIFACT_LABELS[artifact.type]}
                        </span>
                        <span className="max-w-[16rem] truncate text-muted-foreground">
                          {artifact.label ?? artifact.refId}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {execution.finishedAt
                ? `Última execução em ${formatDateTime(execution.finishedAt)}`
                : "Execução em andamento…"}
              {execution.attempts > 1 && ` · ${execution.attempts} tentativas`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
