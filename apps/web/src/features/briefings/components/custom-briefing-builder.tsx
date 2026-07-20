"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CustomBriefingFieldType } from "@/services/briefings";

/** Tipos que o usuário monta, com rótulo humano. */
const FIELD_TYPE_OPTIONS: { value: CustomBriefingFieldType; label: string }[] = [
  { value: "TEXT", label: "Texto curto" },
  { value: "TEXTAREA", label: "Texto longo" },
  { value: "SELECT", label: "Escolha única" },
  { value: "MULTI_SELECT", label: "Múltipla escolha" },
  { value: "FILE", label: "Fotos / vídeos / arquivos" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefone / WhatsApp" },
  { value: "URL", label: "Link (URL)" },
];

export interface BuilderField {
  id: string;
  label: string;
  type: CustomBriefingFieldType;
  required: boolean;
  /** SELECT/MULTI_SELECT: opções separadas por vírgula (parse no submit). */
  optionsText: string;
}

export function emptyBuilderField(): BuilderField {
  return {
    id: crypto.randomUUID(),
    label: "",
    type: "TEXT",
    required: false,
    optionsText: "",
  };
}

const NEEDS_OPTIONS: CustomBriefingFieldType[] = ["SELECT", "MULTI_SELECT"];

// Limites espelhados do DTO da API (createCustomBriefingSchema) -- validar
// aqui evita o cliente montar tudo e receber só um "Erro ao criar" genérico.
const MAX_FIELDS = 30;
const MAX_OPTIONS = 30;
const MAX_OPTION_LEN = 80;

export function parseOptions(text: string): string[] {
  // dedup: opções repetidas quebram o render (React key duplicada + toggle
  // compartilhado no MULTI_SELECT). Case-insensitive pra não passar
  // "Bayer"/"bayer" como distintas.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const o = raw.trim();
    if (!o) continue;
    const k = o.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

/** Erro de validação amigável ou null se o formulário está pronto. */
export function validateBuilder(title: string, fields: BuilderField[]): string | null {
  if (title.trim().length < 3) return "Dê um nome pro formulário (mín. 3 letras).";
  if (fields.length === 0) return "Adicione pelo menos um campo.";
  if (fields.length > MAX_FIELDS) return `Máximo de ${MAX_FIELDS} campos por formulário.`;
  for (const field of fields) {
    if (!field.label.trim()) return "Todo campo precisa de uma pergunta/título.";
    if (NEEDS_OPTIONS.includes(field.type)) {
      const options = parseOptions(field.optionsText);
      if (options.length < 2) {
        return `O campo "${field.label}" precisa de pelo menos 2 opções (separe por vírgula).`;
      }
      if (options.length > MAX_OPTIONS) {
        return `O campo "${field.label}" pode ter no máximo ${MAX_OPTIONS} opções.`;
      }
      const tooLong = options.find((o) => o.length > MAX_OPTION_LEN);
      if (tooLong) {
        return `A opção "${tooLong.slice(0, 24)}…" é muito longa (máx. ${MAX_OPTION_LEN} caracteres).`;
      }
    }
  }
  return null;
}

interface CustomBriefingBuilderProps {
  title: string;
  onTitleChange: (v: string) => void;
  includeContact: boolean;
  onIncludeContactChange: (v: boolean) => void;
  fields: BuilderField[];
  onFieldsChange: (fields: BuilderField[]) => void;
}

/**
 * Editor do briefing personalizado: o usuário monta só os campos que quer
 * perguntar (ex.: pra Kavita Agro, apenas "Quais marcas você trabalha?").
 */
export function CustomBriefingBuilder({
  title,
  onTitleChange,
  includeContact,
  onIncludeContactChange,
  fields,
  onFieldsChange,
}: CustomBriefingBuilderProps) {
  const [expanded, setExpanded] = useState<string | null>(fields[0]?.id ?? null);

  function patchField(id: string, patch: Partial<BuilderField>) {
    onFieldsChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    onFieldsChange(fields.filter((f) => f.id !== id));
  }

  function moveField(id: string, dir: -1 | 1) {
    const index = fields.findIndex((f) => f.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onFieldsChange(next);
  }

  function addField() {
    if (fields.length >= MAX_FIELDS) return;
    const field = emptyBuilderField();
    onFieldsChange([...fields, field]);
    setExpanded(field.id);
  }

  return (
    <div className="flex max-h-[52vh] flex-col gap-4 overflow-y-auto pr-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="custom-title">Nome do formulário</Label>
        <Input
          id="custom-title"
          placeholder='Ex.: "Kavita Agro — informações e marcas"'
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={80}
        />
      </div>

      <label className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="text-sm">
          Pedir dados de contato
          <span className="block text-xs text-muted-foreground">
            Nome, WhatsApp e e-mail no início do formulário.
          </span>
        </span>
        <Switch checked={includeContact} onCheckedChange={onIncludeContactChange} />
      </label>

      <div className="flex flex-col gap-2">
        <Label>Campos</Label>
        {fields.map((field, index) => {
          const isOpen = expanded === field.id;
          return (
            <div key={field.id} className="rounded-lg border border-border">
              <div className="flex items-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : field.id)}
                  className="flex-1 truncate text-left text-sm font-medium"
                >
                  {field.label.trim() || `Campo ${index + 1}`}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {FIELD_TYPE_OPTIONS.find((o) => o.value === field.type)?.label}
                    {field.required ? " · obrigatório" : ""}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === 0}
                  onClick={() => moveField(field.id, -1)}
                  aria-label="Mover para cima"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  disabled={index === fields.length - 1}
                  onClick={() => moveField(field.id, 1)}
                  aria-label="Mover para baixo"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeField(field.id)}
                  aria-label="Remover campo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {isOpen && (
                <div className="flex flex-col gap-3 border-t border-border p-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Pergunta</Label>
                    <Input
                      placeholder='Ex.: "Quais marcas você trabalha?"'
                      value={field.label}
                      onChange={(e) => patchField(field.id, { label: e.target.value })}
                      maxLength={120}
                    />
                  </div>
                  <div className="grid grid-cols-2 items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Tipo de resposta</Label>
                      <Select
                        value={field.type}
                        onValueChange={(v) =>
                          patchField(field.id, { type: v as CustomBriefingFieldType })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 pb-2 text-sm">
                      <Checkbox
                        checked={field.required}
                        onCheckedChange={(v) => patchField(field.id, { required: v === true })}
                      />
                      Obrigatório
                    </label>
                  </div>
                  {NEEDS_OPTIONS.includes(field.type) && (
                    <div className="flex flex-col gap-1.5">
                      <Label>Opções (separe por vírgula)</Label>
                      <Input
                        placeholder="Ex.: Bayer, Syngenta, Corteva, Outra"
                        value={field.optionsText}
                        onChange={(e) => patchField(field.id, { optionsText: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={addField}
          disabled={fields.length >= MAX_FIELDS}
          className="self-start"
        >
          <Plus className="h-4 w-4" /> Adicionar campo
        </Button>
        {fields.length >= MAX_FIELDS && (
          <p className="text-xs text-muted-foreground">Máximo de {MAX_FIELDS} campos.</p>
        )}
      </div>
    </div>
  );
}
