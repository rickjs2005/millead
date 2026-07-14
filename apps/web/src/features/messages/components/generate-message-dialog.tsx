"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAiStatus, useDraftMessage } from "@/features/ai/hooks";
import { useMessageTemplates } from "@/features/messages/hooks";
import { MESSAGE_CHANNEL_LABELS } from "@/features/messages/message-labels";
import type { MessageChannel } from "@/types/api";

const NO_TEMPLATE = "none";

export function GenerateMessageDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<MessageChannel>("WHATSAPP");
  const [templateId, setTemplateId] = useState<string>(NO_TEMPLATE);
  const [instructions, setInstructions] = useState("");

  const { data: aiStatus } = useAiStatus();
  const { data: templates } = useMessageTemplates();
  const draftMessage = useDraftMessage(leadId);

  const aiEnabled = aiStatus?.enabled ?? false;
  const activeTemplates = (templates ?? []).filter(
    (t) => t.isActive && t.channel === channel,
  );

  async function handleGenerate() {
    await draftMessage.mutateAsync({
      channel,
      templateId: templateId === NO_TEMPLATE ? undefined : templateId,
      instructions: instructions.trim() || undefined,
    });
    setInstructions("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={!aiEnabled}
          title={
            aiEnabled ? undefined : "IA desabilitada — configure ANTHROPIC_API_KEY no .env da API."
          }
        >
          <Sparkles /> Gerar mensagem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar mensagem com IA</DialogTitle>
          <DialogDescription>
            A IA escreve um rascunho personalizado com os dados do lead, da empresa e da
            auditoria do site. Nada é enviado automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Canal</Label>
              <Select
                value={channel}
                onValueChange={(v) => {
                  setChannel(v as MessageChannel);
                  setTemplateId(NO_TEMPLATE);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MESSAGE_CHANNEL_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Modelo (opcional)</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Sem modelo</SelectItem>
                  {activeTemplates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ai-instructions">Instruções (opcional)</Label>
            <Textarea
              id="ai-instructions"
              rows={3}
              placeholder="Ex.: tom informal, mencionar que o site deles está lento…"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleGenerate} disabled={draftMessage.isPending}>
            {draftMessage.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Escrevendo…
              </>
            ) : (
              "Gerar rascunho"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
