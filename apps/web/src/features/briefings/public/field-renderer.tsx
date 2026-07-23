"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BriefingField, BriefingFile } from "@/types/api";
import { FileField } from "./file-field";
import {
  isMultiField,
  maskCEP,
  maskCNPJ,
  maskPhoneBR,
  normalizeUrl,
  pickMask,
} from "./field-utils";
import { TagsInput } from "./tags-input";
import type { LocalAnswer } from "./use-briefing-wizard";

interface FieldRendererProps {
  field: BriefingField;
  value: LocalAnswer | undefined;
  onChange: (patch: LocalAnswer, opts?: { debounce?: boolean }) => void;
  token: string;
  files: Record<string, BriefingFile>;
  onFileRegistered: (file: BriefingFile) => void;
  /** Adivinhação de máscara/chips pelo NOME do campo -- só em templates do
   * seed (keys controladas). Em briefing personalizado fica desligada, senão
   * um texto chamado "Estado"/"CNPJ" viraria chips/máscara sem o admin querer. */
  keyHeuristics?: boolean;
}

/** Renderiza UM campo (não-GROUP) a partir de `field.type` -- ver RepeatableGroupField pro caso GROUP. */
export function FieldRenderer({
  field,
  value,
  onChange,
  token,
  files,
  onFileRegistered,
  keyHeuristics = true,
}: FieldRendererProps) {
  switch (field.type) {
    // Cidade/Estado (ou qualquer TEXT marcado como multi) viram chips: o
    // negócio pode atender mais de uma cidade/estado (ex.: Kavita Drones).
    case "TEXT": {
      if (isMultiField(field.key, field.config, keyHeuristics)) {
        return (
          <TagsInput
            value={value?.valueText}
            onChange={(joined) => onChange({ valueText: joined })}
            placeholder="Digite e aperte Enter para adicionar mais…"
          />
        );
      }
      // CEP/CNPJ (ou config.mask) ganham máscara automática. Placeholder
      // amarrado à máscara REAL escolhida -- não ao nome do campo.
      const mask = pickMask(field.key, field.config, keyHeuristics);
      const isCep = mask === maskCEP;
      const isCnpj = mask === maskCNPJ;
      return (
        <Input
          inputMode={mask ? "numeric" : undefined}
          placeholder={isCnpj ? "00.000.000/0000-00" : isCep ? "00000-000" : undefined}
          value={value?.valueText ?? ""}
          onChange={(e) => onChange({ valueText: mask ? mask(e.target.value) : e.target.value })}
        />
      );
    }

    case "EMAIL":
      return (
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          value={value?.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
        />
      );

    // Máscara de telefone/WhatsApp: formata (XX) XXXXX-XXXX enquanto digita.
    case "PHONE":
      return (
        <Input
          type="tel"
          inputMode="tel"
          placeholder="(00) 00000-0000"
          value={value?.valueText ?? ""}
          onChange={(e) => onChange({ valueText: maskPhoneBR(e.target.value) })}
        />
      );

    // URL: completa https:// ao sair do campo, se o cliente esquecer.
    case "URL":
      return (
        <Input
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={value?.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
          onBlur={(e) => {
            const normalized = normalizeUrl(e.target.value);
            if (normalized !== e.target.value)
              onChange({ valueText: normalized }, { debounce: false });
          }}
        />
      );

    case "TEXTAREA":
      return (
        <Textarea
          rows={4}
          value={value?.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
        />
      );

    case "SELECT": {
      const options = (field.config as { options?: string[] } | null)?.options ?? [];
      return (
        <Select
          value={value?.valueText ?? undefined}
          onValueChange={(v) => onChange({ valueText: v }, { debounce: false })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "MULTI_SELECT": {
      const options = (field.config as { options?: string[] } | null)?.options ?? [];
      const selected = Array.isArray(value?.valueJson) ? (value!.valueJson as string[]) : [];
      return (
        <div className="flex flex-col">
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              // py-3 leva a linha inteira (área clicável do <label>) a ~44px
              // de altura -- por padrão ficava só ~20px (altura do texto),
              // bem abaixo do mínimo de toque recomendado (Apple/Google
              // ~44px), fácil de errar num celular com várias opções juntas.
              <label key={option} className="flex items-center gap-3 py-3 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) =>
                    onChange(
                      {
                        valueJson: c ? [...selected, option] : selected.filter((s) => s !== option),
                      },
                      { debounce: false },
                    )
                  }
                />
                {option}
              </label>
            );
          })}
        </div>
      );
    }

    case "FILE":
      return (
        <FileField
          field={field}
          value={value}
          files={files}
          token={token}
          onChange={onChange}
          onFileRegistered={onFileRegistered}
        />
      );

    case "GROUP":
      return null;

    default:
      return null;
  }
}
