"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisDialog } from "@/features/milsocial/components/analysis-dialog";
import { ComparisonTable } from "@/features/milsocial/components/comparison-table";
import { MetricsChart } from "@/features/milsocial/components/metrics-chart";
import { PostList } from "@/features/milsocial/components/post-list";
import {
  useAnalysisMutation,
  useComparison,
  useSocialPosts,
  useSyncMutation,
} from "@/features/milsocial/hooks";
import { ApiError } from "@/services/api-client";
import type { SocialAnalysis } from "@/types/api";

export default function MilsocialPage() {
  const postsQuery = useSocialPosts();
  const comparisonQuery = useComparison();
  const syncMutation = useSyncMutation();
  const analysisMutation = useAnalysisMutation();

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysis, setAnalysis] = useState<SocialAnalysis | null>(null);

  async function handleAnalyze() {
    setAnalysisOpen(true);
    try {
      const result = await analysisMutation.mutateAsync();
      setAnalysis(result);
    } catch {
      // Erro já vira toast no hook (useAnalysisMutation.onError) -- só
      // fecha o dialog pra não deixar "Gerando análise…" parado pra sempre.
      setAnalysisOpen(false);
    }
  }

  const posts = postsQuery.data ?? [];
  const isEmpty = postsQuery.isSuccess && posts.length === 0;
  const syncErrorMessage =
    syncMutation.error instanceof ApiError
      ? syncMutation.error.message
      : syncMutation.isError
        ? "Erro ao sincronizar."
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">MilSocial</h1>
          <p className="text-sm text-muted-foreground">Métricas do Instagram da MilWeb</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Sincronizar agora
            </Button>
            <Button disabled={analysisMutation.isPending} onClick={handleAnalyze}>
              {analysisMutation.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Gerar análise
            </Button>
          </div>
          {syncMutation.isSuccess && (
            <p className="text-xs text-muted-foreground">
              {syncMutation.data.postsCreated} novos, {syncMutation.data.snapshotsSaved} snapshots
            </p>
          )}
          {syncErrorMessage && <p className="text-xs text-destructive">{syncErrorMessage}</p>}
        </div>
      </div>

      {postsQuery.isError ? (
        <ErrorState onRetry={() => postsQuery.refetch()} />
      ) : postsQuery.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isEmpty ? (
        <Card className="flex flex-col items-center justify-center gap-1 px-6 py-20 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum post sincronizado ainda.</p>
          <p className="text-sm text-muted-foreground">Clique em Sincronizar agora.</p>
        </Card>
      ) : (
        <>
          <ComparisonTable rows={comparisonQuery.data ?? []} />
          <MetricsChart posts={posts} />
          <PostList posts={posts} />
        </>
      )}

      <AnalysisDialog
        analysis={analysis}
        loading={analysisMutation.isPending}
        open={analysisOpen}
        onOpenChange={(open) => {
          setAnalysisOpen(open);
          if (!open) setAnalysis(null);
        }}
      />
    </div>
  );
}
