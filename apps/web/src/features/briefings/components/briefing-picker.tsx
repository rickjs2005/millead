"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deveAplicarBriefing } from "@/features/briefings/briefing-apply";
import { useBriefing, useBriefings } from "@/features/briefings/hooks";
import { formatDate } from "@/utils/format";
import type { BriefingDetail } from "@/types/api";

/**
 * Seletor genérico "Preencher do briefing": lista briefings com alguma
 * resposta (concluídos primeiro) e, ao escolher um, busca o detalhe e o
 * entrega ao consumidor via `onDetail` — cada formulário (contrato,
 * orçamento…) faz o próprio mapeamento de respostas → campos.
 *
 * O estado da seleção vive aqui; montado dentro de um Dialog, zera sozinho
 * ao fechar (o conteúdo desmonta). Some quando não há briefing respondido.
 */
export function BriefingPicker({
  onDetail,
  hint,
}: {
  onDetail: (detail: BriefingDetail) => void;
  /** Texto de apoio explicando O QUE será preenchido neste formulário. */
  hint: string;
}) {
  const [briefingId, setBriefingId] = useState<string | undefined>(undefined);
  const { data } = useBriefings({ pageSize: 100 });
  const { data: detail, isFetching } = useBriefing(briefingId);

  const options = (data?.items ?? [])
    .filter((b) => b.status === "COMPLETED" || b.progressPercent > 0)
    .sort((a, b) => (a.status === "COMPLETED" ? 0 : 1) - (b.status === "COMPLETED" ? 0 : 1));

  // `onDetail` fica num ref, FORA das dependências: os consumidores passam
  // função nova a cada render (arrow inline ou declarada no componente), e
  // com ela na lista o efeito reaplicava o briefing a cada renderização --
  // apagando o que o dono digitava e mantendo a aba em 100% de CPU.
  const onDetailRef = useRef(onDetail);
  onDetailRef.current = onDetail;
  // Aplica UMA vez por briefing escolhido (trocar de briefing aplica o novo).
  const jaAplicadoRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !deveAplicarBriefing({
        detailId: detail?.id,
        briefingId,
        jaAplicadoId: jaAplicadoRef.current,
      })
    ) {
      return;
    }
    jaAplicadoRef.current = detail!.id;
    onDetailRef.current(detail!);
  }, [detail, briefingId]);

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
        {isFetching ? "Carregando respostas do briefing…" : hint}
      </p>
    </div>
  );
}
