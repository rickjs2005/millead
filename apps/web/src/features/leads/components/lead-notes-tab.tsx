"use client";

import { StickyNote } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddLeadNote } from "@/features/leads/hooks";
import { formatDateTime } from "@/utils/format";
import type { LeadNote } from "@/types/api";

export function LeadNotesTab({ leadId, notes }: { leadId: string; notes: LeadNote[] }) {
  const [body, setBody] = useState("");
  const addNote = useAddLeadNote(leadId);

  async function handleSubmit() {
    if (!body.trim()) return;
    await addNote.mutateAsync(body.trim());
    setBody("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Escreva uma observação sobre este lead…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <Button
          onClick={handleSubmit}
          disabled={!body.trim() || addNote.isPending}
          className="self-end"
        >
          {addNote.isPending ? "Salvando…" : "Adicionar nota"}
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Nenhuma observação ainda"
          className="border-none py-12"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border p-3">
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
