"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { EstimateEditor } from "@/features/estimates/components/estimate-editor";

export default function NewEstimatePage() {
  // Unificação (Fase 6): "Novo orçamento" a partir do detalhe de um lead
  // (quick action) e da página de Propostas linkam pra cá com `?leadId=...`
  // -- o editor pré-seleciona o lead em vez de nascer sem vínculo.
  const searchParams = useSearchParams();
  const leadId = searchParams.get("leadId");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/estimates"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Orçamentos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Novo orçamento</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados e acompanhe o preço recomendado em tempo real.
        </p>
      </div>

      <EstimateEditor defaultLeadId={leadId ?? undefined} />
    </div>
  );
}
