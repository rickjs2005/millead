"use client";

import { Check, Copy, MessageCircle, Plus, ShoppingCart, Building2 as StoreIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { LeadCombobox } from "@/features/leads/components/lead-combobox";
import { useCreateBriefing } from "@/features/briefings/hooks";
import type { BriefingTemplateKind } from "@/types/api";

const TEMPLATE_OPTIONS: { kind: BriefingTemplateKind; key: string; label: string; description: string; icon: typeof StoreIcon }[] = [
  {
    kind: "INSTITUCIONAL",
    key: "institucional-v1",
    label: "Site Institucional",
    description: "Empresa, serviços, identidade visual e referências.",
    icon: StoreIcon,
  },
  {
    kind: "ECOMMERCE",
    key: "ecommerce-v1",
    label: "Loja Virtual",
    description: "Tudo do institucional + produtos, frete e pagamento.",
    icon: ShoppingCart,
  },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export function CreateBriefingDialog() {
  const [open, setOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [createdLink, setCreatedLink] = useState<{ token: string; leadTitle?: string } | null>(
    null,
  );
  const createBriefing = useCreateBriefing();

  function reset() {
    setTemplateKey(null);
    setLeadId(undefined);
    setCreatedLink(null);
  }

  async function handleGenerate() {
    if (!templateKey) return;
    const briefing = await createBriefing.mutateAsync({ templateKey, leadId });
    setCreatedLink({ token: briefing.link.token });
  }

  const publicUrl = createdLink ? `${APP_URL}/b/${createdLink.token}` : "";

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado.");
  }

  function shareWhatsapp() {
    const text = encodeURIComponent(
      `Olá! Pra começarmos seu projeto, preencha esse briefing rápido: ${publicUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  function shareEmail() {
    const subject = encodeURIComponent("Briefing do seu projeto — MilWeb");
    const body = encodeURIComponent(
      `Olá!\n\nPra começarmos seu projeto, preencha esse briefing rápido:\n${publicUrl}\n\nQualquer dúvida, é só chamar.`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo briefing
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{createdLink ? "Briefing criado" : "Novo briefing"}</DialogTitle>
        </DialogHeader>

        {createdLink ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Link gerado — envie pro cliente preencher.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border p-2">
              <code className="flex-1 truncate text-xs text-foreground">{publicUrl}</code>
              <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copiar link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={shareWhatsapp}>
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button variant="outline" onClick={shareEmail}>
                E-mail
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = templateKey === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTemplateKey(option.key)}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <Icon className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Lead (opcional)</Label>
              <LeadCombobox value={leadId} onChange={(id) => setLeadId(id)} />
            </div>
          </div>
        )}

        <DialogFooter>
          {createdLink ? (
            <Button onClick={() => setOpen(false)}>Concluir</Button>
          ) : (
            <Button disabled={!templateKey || createBriefing.isPending} onClick={handleGenerate}>
              {createBriefing.isPending ? "Gerando…" : "Gerar link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
