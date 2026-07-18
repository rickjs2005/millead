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
import type { LocalAnswer } from "./use-briefing-wizard";

interface FieldRendererProps {
  field: BriefingField;
  value: LocalAnswer | undefined;
  onChange: (patch: LocalAnswer, opts?: { debounce?: boolean }) => void;
  token: string;
  files: Record<string, BriefingFile>;
  onFileRegistered: (file: BriefingFile) => void;
}

/** Renderiza UM campo (não-GROUP) a partir de `field.type` -- ver RepeatableGroupField pro caso GROUP. */
export function FieldRenderer({ field, value, onChange, token, files, onFileRegistered }: FieldRendererProps) {
  switch (field.type) {
    case "TEXT":
    case "EMAIL":
    case "PHONE":
    case "URL":
      return (
        <Input
          type={field.type === "EMAIL" ? "email" : field.type === "URL" ? "url" : "text"}
          value={value?.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
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
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const checked = selected.includes(option);
            return (
              <label key={option} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) =>
                    onChange(
                      {
                        valueJson: c
                          ? [...selected, option]
                          : selected.filter((s) => s !== option),
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
