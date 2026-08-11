"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { NarrationMode } from "../types";

interface NarrationFieldsProps {
  mode: NarrationMode;
  text: string;
  customInstructions: string;
  wordBudget: number;
  onChange: (patch: { mode?: NarrationMode; text?: string; customInstructions?: string }) => void;
}

const ROTULOS: Record<NarrationMode, string> = {
  auto: "Automática",
  manual: "Escrever manualmente",
  custom: "Instruções próprias",
};

function contarPalavras(texto: string): number {
  return texto.trim() ? texto.trim().split(/\s+/).length : 0;
}

export function NarrationFields({
  mode,
  text,
  customInstructions,
  wordBudget,
  onChange,
}: NarrationFieldsProps) {
  const palavras = contarPalavras(text);
  const estourou = mode === "manual" && palavras > wordBudget;

  return (
    <div className="space-y-2">
      <Label>Narração</Label>
      <Select value={mode} onValueChange={(v) => onChange({ mode: v as NarrationMode })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(ROTULOS) as NarrationMode[]).map((m) => (
            <SelectItem key={m} value={m}>
              {ROTULOS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mode === "manual" && (
        <>
          <Textarea
            value={text}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={6}
            placeholder="Escreva a narração do vídeo."
            aria-label="Texto da narração"
          />
          <p className={estourou ? "text-sm text-amber-600" : "text-sm text-muted-foreground"}>
            {palavras} de {wordBudget} palavras
            {estourou ? " — acima do orçamento; a narração vai passar do tempo do vídeo." : ""}
          </p>
        </>
      )}

      {mode === "custom" && (
        <Textarea
          value={customInstructions}
          onChange={(e) => onChange({ customInstructions: e.target.value })}
          rows={4}
          placeholder="Ex.: tom bem-humorado, citar o atendimento no mesmo dia."
          aria-label="Instruções próprias para a narração"
        />
      )}
    </div>
  );
}
