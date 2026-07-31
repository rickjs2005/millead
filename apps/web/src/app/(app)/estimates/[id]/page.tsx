"use client";

import { ArrowLeft, Calculator } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EstimateEditor } from "@/features/estimates/components/estimate-editor";
import { useEstimate } from "@/features/estimates/hooks";

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: estimate, isLoading } = useEstimate(id);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!estimate) {
    return <EmptyState icon={Calculator} title="Orçamento não encontrado" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/estimates"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Orçamentos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{estimate.title}</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe o preço recomendado em tempo real conforme edita.
        </p>
      </div>

      <EstimateEditor estimate={estimate} />
    </div>
  );
}
