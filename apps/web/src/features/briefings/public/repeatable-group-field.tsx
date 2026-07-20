"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BriefingField, BriefingFile } from "@/types/api";
import { FieldRenderer } from "./field-renderer";
import type { LocalAnswer } from "./use-briefing-wizard";

interface RepeatableGroupFieldProps {
  field: BriefingField;
  groupItemIds: string[];
  getAnswer: (fieldId: string, groupItemId?: string) => LocalAnswer | undefined;
  setValue: (
    fieldId: string,
    groupItemId: string,
    patch: LocalAnswer,
    opts?: { debounce?: boolean },
  ) => void;
  addItem: (groupFieldId: string) => string;
  removeItem: (groupFieldId: string, groupItemId: string) => void;
  files: Record<string, BriefingFile>;
  registerFile: (file: BriefingFile) => void;
  token: string;
  keyHeuristics?: boolean;
}

export function RepeatableGroupField({
  field,
  groupItemIds,
  getAnswer,
  setValue,
  addItem,
  removeItem,
  files,
  registerFile,
  token,
  keyHeuristics = true,
}: RepeatableGroupFieldProps) {
  const config = field.config as {
    minItems?: number;
    maxItems?: number;
    itemLabel?: string;
  } | null;
  const itemLabel = config?.itemLabel ?? "Item";
  const maxItems = config?.maxItems ?? 20;

  return (
    <div className="flex flex-col gap-3">
      {groupItemIds.map((groupItemId, index) => (
        <div key={groupItemId} className="rounded-lg border border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">
              {itemLabel} {index + 1}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(field.id, groupItemId)}
              aria-label={`Remover ${itemLabel.toLowerCase()}`}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex flex-col gap-3">
            {field.children?.map((child) => (
              <div key={child.id} className="flex flex-col gap-1.5">
                <Label>
                  {child.label}
                  {child.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <FieldRenderer
                  field={child}
                  value={getAnswer(child.id, groupItemId)}
                  onChange={(patch, opts) => setValue(child.id, groupItemId, patch, opts)}
                  token={token}
                  files={files}
                  onFileRegistered={registerFile}
                  keyHeuristics={keyHeuristics}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {groupItemIds.length < maxItems && (
        <Button type="button" variant="outline" onClick={() => addItem(field.id)}>
          <Plus className="h-4 w-4" /> Adicionar {itemLabel.toLowerCase()}
        </Button>
      )}
    </div>
  );
}
