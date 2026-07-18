"use client";

import { put } from "@vercel/blob/client";
import { Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { briefingsPublicService } from "@/services/briefings-public";
import type { BriefingField, BriefingFile } from "@/types/api";
import type { LocalAnswer } from "./use-briefing-wizard";

interface FileFieldProps {
  field: BriefingField;
  value: LocalAnswer | undefined;
  files: Record<string, BriefingFile>;
  token: string;
  onChange: (patch: LocalAnswer, opts?: { debounce?: boolean }) => void;
  onFileRegistered: (file: BriefingFile) => void;
}

export function FileField({ field, value, files, token, onChange, onFileRegistered }: FileFieldProps) {
  const [uploading, setUploading] = useState(false);
  const ids = Array.isArray(value?.valueJson) ? (value!.valueJson as string[]) : [];
  const config = field.config as { accept?: string[]; maxFiles?: number } | null;
  const accept = config?.accept?.join(",");
  const maxFiles = config?.maxFiles ?? 1;

  async function handleFiles(fileList: FileList) {
    const selected = Array.from(fileList);
    if (ids.length + selected.length > maxFiles) {
      toast.error(`Máximo de ${maxFiles} arquivo(s) neste campo.`);
      return;
    }
    setUploading(true);
    try {
      const newIds: string[] = [];
      for (const file of selected) {
        const contentType = file.type || "application/octet-stream";
        const { clientToken, pathname } = await briefingsPublicService.createUploadToken(token, {
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        });
        const blob = await put(pathname, file, {
          access: "public",
          token: clientToken,
          contentType,
        });
        const record = await briefingsPublicService.confirmFile(token, {
          blobUrl: blob.url,
          pathname: blob.pathname,
          originalName: file.name,
          mimeType: contentType,
          sizeBytes: file.size,
        });
        onFileRegistered(record);
        newIds.push(record.id);
      }
      onChange({ valueJson: [...ids, ...newIds] }, { debounce: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground transition-colors hover:bg-accent">
        <Upload className="h-5 w-5" />
        {uploading ? "Enviando…" : "Clique para enviar ou arraste o arquivo"}
        <input
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          disabled={uploading}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {ids.length > 0 && (
        <ul className="flex flex-col gap-1">
          {ids.map((id) => {
            const file = files[id];
            if (!file) return null;
            return (
              <li
                key={id}
                className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-xs"
              >
                <span className="truncate">{file.originalName}</span>
                <button
                  type="button"
                  onClick={() => onChange({ valueJson: ids.filter((i) => i !== id) }, { debounce: false })}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Remover arquivo"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
