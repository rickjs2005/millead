"use client";

import { Copy, FileText, Gauge, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { scoreColorClass } from "@/features/audit/audit-labels";
import { SimpleMarkdown } from "@/features/ai/components/simple-markdown";
import { useAiStatus, useLeadReport, useScoreLead } from "@/features/ai/hooks";
import { useAddLeadNote } from "@/features/leads/hooks";
import { cn } from "@/lib/utils";
import type { LeadDetail, LeadScoreResponse } from "@/types/api";

export function LeadAiMenu({ lead }: { lead: LeadDetail }) {
  const { data: aiStatus } = useAiStatus();
  const scoreLead = useScoreLead(lead.id);
  const leadReport = useLeadReport(lead.id);
  const addNote = useAddLeadNote(lead.id);

  const [scoreResult, setScoreResult] = useState<LeadScoreResponse | null>(null);
  const [report, setReport] = useState<string | null>(null);

  const aiEnabled = aiStatus?.enabled ?? false;
  const busy = scoreLead.isPending || leadReport.isPending;

  async function handleScore() {
    const result = await scoreLead.mutateAsync();
    setScoreResult(result);
  }

  async function handleReport() {
    const result = await leadReport.mutateAsync();
    setReport(result.report);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={busy}
            title={
              aiEnabled
                ? undefined
                : "IA desabilitada — configure ANTHROPIC_API_KEY no .env da API."
            }
          >
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} IA
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!aiEnabled || busy} onSelect={handleScore}>
            <Gauge /> Calcular score de oportunidade
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!aiEnabled || busy} onSelect={handleReport}>
            <FileText /> Gerar relatório do lead
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Resultado do score */}
      <Dialog open={!!scoreResult} onOpenChange={(open) => !open && setScoreResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Score de oportunidade</DialogTitle>
            <DialogDescription>
              Calculado pela IA com base no lead, na empresa e na auditoria do site.
            </DialogDescription>
          </DialogHeader>
          {scoreResult && (
            <div className="flex flex-col items-center gap-3 py-2">
              <span
                className={cn(
                  "text-6xl font-bold tabular-nums",
                  scoreColorClass(scoreResult.score),
                )}
              >
                {scoreResult.score}
              </span>
              <p className="text-center text-sm text-muted-foreground">{scoreResult.rationale}</p>
              <p className="text-xs text-muted-foreground">
                A justificativa também ficou registrada no histórico do lead.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Relatório */}
      <Dialog open={!!report} onOpenChange={(open) => !open && setReport(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Relatório do lead</DialogTitle>
          </DialogHeader>
          {report && (
            <>
              <ScrollArea className="max-h-[55dvh] pr-3">
                <SimpleMarkdown text={report} />
              </ScrollArea>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(report);
                    toast.success("Relatório copiado.");
                  }}
                >
                  <Copy /> Copiar
                </Button>
                <Button
                  disabled={addNote.isPending}
                  onClick={async () => {
                    await addNote.mutateAsync(report);
                    setReport(null);
                  }}
                >
                  {addNote.isPending ? "Salvando…" : "Salvar como observação"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
