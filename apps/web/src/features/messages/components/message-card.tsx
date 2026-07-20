"use client";

import { Check, Copy, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateMessage } from "@/features/messages/hooks";
import {
  MESSAGE_CHANNEL_LABELS,
  MESSAGE_STATUS_LABELS,
  MESSAGE_STATUS_VARIANT,
} from "@/features/messages/message-labels";
import { useLead } from "@/features/leads/hooks";
import { formatDateTime } from "@/utils/format";
import type { Message } from "@/types/api";

export function MessageCard({ message, showLead }: { message: Message; showLead?: boolean }) {
  const updateMessage = useUpdateMessage();
  const { data: lead } = useLead(showLead ? message.leadId : undefined);
  const [editOpen, setEditOpen] = useState(false);
  const [draftBody, setDraftBody] = useState(message.body);

  const isDraft = message.status === "DRAFT";

  function copyBody() {
    void navigator.clipboard.writeText(message.body);
    toast.success("Mensagem copiada.");
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{MESSAGE_CHANNEL_LABELS[message.channel]}</Badge>
          <Badge variant={MESSAGE_STATUS_VARIANT[message.status]}>
            {MESSAGE_STATUS_LABELS[message.status]}
          </Badge>
          {showLead && lead && (
            <Link
              href={`/leads/${message.leadId}`}
              className="truncate text-sm font-medium hover:underline"
            >
              {lead.title}
            </Link>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {message.sentAt
              ? `Enviada em ${formatDateTime(message.sentAt)}`
              : `Criada em ${formatDateTime(message.createdAt)}`}
          </span>
        </div>

        <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{message.body}</p>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={copyBody}>
            <Copy /> Copiar
          </Button>
          {isDraft && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDraftBody(message.body);
                  setEditOpen(true);
                }}
              >
                <Pencil /> Editar
              </Button>
              <Button
                size="sm"
                disabled={updateMessage.isPending}
                onClick={() =>
                  updateMessage.mutate({ id: message.id, payload: { status: "SENT" } })
                }
                title="Marque depois de enviar a mensagem pelo canal (WhatsApp, e-mail...)."
              >
                <Check /> Marcar como enviada
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar rascunho</DialogTitle>
          </DialogHeader>
          <Textarea rows={8} value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
          <DialogFooter>
            <Button
              disabled={updateMessage.isPending || draftBody.trim().length === 0}
              onClick={async () => {
                await updateMessage.mutateAsync({
                  id: message.id,
                  payload: { body: draftBody.trim() },
                });
                setEditOpen(false);
              }}
            >
              {updateMessage.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
