"use client";

import {
  Check,
  Copy,
  MessageCircle,
  Plus,
  ShoppingCart,
  SlidersHorizontal,
  Building2 as StoreIcon,
} from "lucide-react";
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
import { publicAppUrl } from "@/lib/public-url";
import { LeadCombobox } from "@/features/leads/components/lead-combobox";
import { useCreateBriefing, useCreateCustomBriefing } from "@/features/briefings/hooks";
import {
  CustomBriefingBuilder,
  emptyBuilderField,
  parseOptions,
  validateBuilder,
  type BuilderField,
} from "@/features/briefings/components/custom-briefing-builder";
import type { BriefingTemplateKind } from "@/types/api";

/** "custom" não é um template do catálogo -- abre o editor de campos. */
const CUSTOM_KEY = "custom";

const TEMPLATE_OPTIONS: {
  kind: BriefingTemplateKind;
  key: string;
  label: string;
  description: string;
  icon: typeof StoreIcon;
}[] = [
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
  {
    kind: "CUSTOM",
    key: CUSTOM_KEY,
    label: "Personalizado",
    description: "Monte só as perguntas que você precisa pra esse cliente.",
    icon: SlidersHorizontal,
  },
];

export function CreateBriefingDialog() {
  const [open, setOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [createdLink, setCreatedLink] = useState<{ token: string; leadTitle?: string } | null>(
    null,
  );
  // estado do formulário personalizado
  const [customTitle, setCustomTitle] = useState("");
  const [includeContact, setIncludeContact] = useState(true);
  const [customFields, setCustomFields] = useState<BuilderField[]>([emptyBuilderField()]);

  const createBriefing = useCreateBriefing();
  const createCustom = useCreateCustomBriefing();
  const isCustom = templateKey === CUSTOM_KEY;
  const isPending = createBriefing.isPending || createCustom.isPending;

  function reset() {
    setTemplateKey(null);
    setLeadId(undefined);
    setCreatedLink(null);
    setCustomTitle("");
    setIncludeContact(true);
    setCustomFields([emptyBuilderField()]);
  }

  async function handleGenerate() {
    if (!templateKey) return;

    if (isCustom) {
      const error = validateBuilder(customTitle, customFields);
      if (error) {
        toast.error(error);
        return;
      }
      const briefing = await createCustom.mutateAsync({
        title: customTitle.trim(),
        leadId,
        includeContact,
        fields: customFields.map((field) => ({
          label: field.label.trim(),
          type: field.type,
          required: field.required,
          options:
            field.type === "SELECT" || field.type === "MULTI_SELECT"
              ? parseOptions(field.optionsText)
              : undefined,
        })),
      });
      setCreatedLink({ token: briefing.link.token });
      return;
    }

    const briefing = await createBriefing.mutateAsync({ templateKey, leadId });
    setCreatedLink({ token: briefing.link.token });
  }

  const publicUrl = createdLink ? `${publicAppUrl()}/b/${createdLink.token}` : "";

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
      <DialogContent className={cn("sm:max-w-lg", isCustom && !createdLink && "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{createdLink ? "Briefing criado" : "Novo briefing"}</DialogTitle>
        </DialogHeader>

        {createdLink ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                Link gerado — envie pro cliente preencher. Vale por 24 horas; depois disso, use
                “Duplicar” pra gerar um link novo.
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
            <div className="grid grid-cols-3 gap-3">
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
                      selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", selected ? "text-primary" : "text-muted-foreground")}
                    />
                    <div>
                      <p className="text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {isCustom && (
              <CustomBriefingBuilder
                title={customTitle}
                onTitleChange={setCustomTitle}
                includeContact={includeContact}
                onIncludeContactChange={setIncludeContact}
                fields={customFields}
                onFieldsChange={setCustomFields}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Lead vinculado (recomendado)</Label>
              <LeadCombobox value={leadId} onChange={(id) => setLeadId(id)} />
              {!leadId && (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Sem lead, o briefing não aparece no funil nem na timeline de ninguém — só na lista
                  de Briefings.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {createdLink ? (
            <Button onClick={() => setOpen(false)}>Concluir</Button>
          ) : (
            <Button disabled={!templateKey || isPending} onClick={handleGenerate}>
              {isPending ? "Gerando…" : "Gerar link"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
