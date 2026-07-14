"use client";

import { Loader2, Rocket } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAiStatus } from "@/features/ai/hooks";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCreateLandingPage } from "@/features/landing-pages/hooks";
import type { LandingPageKind } from "@/types/api";

export function CreateLandingPageDialog() {
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [kind, setKind] = useState<LandingPageKind>("DEMO_SITE");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");

  const { data: aiStatus } = useAiStatus();
  const createPage = useCreateLandingPage();
  const aiEnabled = aiStatus?.enabled ?? false;

  async function handleCreate() {
    if (!companyId) return;
    await createPage.mutateAsync({
      companyId,
      kind,
      title: title.trim() || undefined,
      brief: brief.trim() || undefined,
    });
    setCompanyId(undefined);
    setTitle("");
    setBrief("");
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
          <Rocket /> Nova landing page
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar landing page com IA</DialogTitle>
          <DialogDescription>
            A IA cria uma página completa usando os dados da empresa e a auditoria do site. A
            geração leva 1-2 minutos e roda em segundo plano.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label>Empresa</Label>
            <CompanyCombobox value={companyId} onChange={(id) => setCompanyId(id)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Objetivo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as LandingPageKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEMO_SITE">
                  Demo do site — “veja como o site de vocês poderia ficar”
                </SelectItem>
                <SelectItem value="PITCH">
                  Página de proposta — convencer o prospect a contratar
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lp-title">Título interno (opcional)</Label>
            <Input
              id="lp-title"
              placeholder="Padrão: nome da empresa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lp-brief">Instruções pra IA (opcional)</Label>
            <Textarea
              id="lp-brief"
              rows={3}
              placeholder="Ex.: destacar delivery, usar tons de verde, público jovem…"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!companyId || createPage.isPending}>
            {createPage.isPending ? (
              <>
                <Loader2 className="animate-spin" /> Enfileirando…
              </>
            ) : (
              "Gerar página"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
