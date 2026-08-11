"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SimpleMarkdown } from "@/features/ai/components/simple-markdown";
import type { SocialAnalysis } from "@/types/api";

interface AnalysisDialogProps {
  analysis: SocialAnalysis | null;
  loading: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AnalysisDialog({ analysis, loading, open, onOpenChange }: AnalysisDialogProps) {
  function handleCopy() {
    if (!analysis) return;
    const text = [
      analysis.report,
      "",
      "Sugestões:",
      ...analysis.suggestions.map((s) => `- ${s}`),
    ].join("\n");
    void navigator.clipboard.writeText(text);
    toast.success("Análise copiada.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Análise da IA</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Gerando análise…</p>
        ) : analysis ? (
          <>
            <ScrollArea className="max-h-[55dvh] pr-3">
              <div className="flex flex-col gap-4">
                <SimpleMarkdown text={analysis.report} />
                {analysis.suggestions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-sm font-semibold">Sugestões</h3>
                    <ul className="flex flex-col gap-1 text-sm">
                      {analysis.suggestions.map((suggestion, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={handleCopy}>
                <Copy /> Copiar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma análise gerada ainda.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
