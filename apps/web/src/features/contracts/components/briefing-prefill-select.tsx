"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBriefing, useBriefings } from "@/features/briefings/hooks";
import {
  contractPrefillFromBriefing,
  type ContractPrefill,
} from "@/features/contracts/briefing-prefill";
import { formatDate } from "@/utils/format";

/**
 * Seletor "Preencher do briefing" do diálogo de novo contrato: escolher um
 * briefing puxa as respostas do cliente e preenche os dados do contratante
 * automaticamente — nada de redigitar o que o cliente já informou.
 *
 * Lista briefings com alguma resposta (concluídos primeiro). O estado vive
 * aqui dentro; o Dialog desmonta o conteúdo ao fechar, então a seleção
 * zera sozinha.
 */
export function BriefingPrefillSelect({
  onPrefill,
}: {
  onPrefill: (prefill: ContractPrefill) => void;
}) {
  const [briefingId, setBriefingId] = useState<string | undefined>(undefined);
  const { data } = useBriefings({ pageSize: 100 });
  const { data: detail, isFetching } = useBriefing(briefingId);

  const options = (data?.items ?? [])
    .filter((b) => b.status === "COMPLETED" || b.progressPercent > 0)
    .sort((a, b) => (a.status === "COMPLETED" ? 0 : 1) - (b.status === "COMPLETED" ? 0 : 1));

  useEffect(() => {
    if (detail && detail.id === briefingId) {
      onPrefill(contractPrefillFromBriefing(detail));
    }
  }, [detail, briefingId, onPrefill]);

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 p-3">
      <Label>Preencher do briefing (opcional)</Label>
      <Select value={briefingId ?? ""} onValueChange={(v) => setBriefingId(v || undefined)}>
        <SelectTrigger>
          <SelectValue placeholder="Escolher um briefing respondido…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.contactName ?? b.contactEmail ?? "Sem nome"} · {formatDate(b.createdAt)}
              {b.status !== "COMPLETED" ? ` · ${b.progressPercent}%` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {isFetching
          ? "Carregando respostas do briefing…"
          : "As respostas do cliente preenchem os dados do contratante. Revise antes de criar."}
      </p>
    </div>
  );
}
