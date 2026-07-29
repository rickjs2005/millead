"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCompany } from "@/features/companies/hooks";
import { buildBrief, scaleDurations, totalDuration, totalWordBudget } from "@/features/video-studio/build-brief";
import { buildPrompt } from "@/features/video-studio/build-prompt";
import { SceneList } from "@/features/video-studio/components/scene-list";
import { TEMPLATES, templateById } from "@/features/video-studio/templates";
import type { FormScene, TotalDuration, VideoFormat } from "@/features/video-studio/types";

const DURACOES: TotalDuration[] = [15, 30, 45, 60];
const FORMATOS: VideoFormat[] = ["9:16", "16:9", "1:1"];

export default function VideosPage() {
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [businessName, setBusinessName] = useState("");
  const [url, setUrl] = useState("");
  const [segment, setSegment] = useState("");
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [totalDurationSec, setTotalDurationSec] = useState<TotalDuration>(30);
  const [format, setFormat] = useState<VideoFormat>("9:16");
  const [scenes, setScenes] = useState<FormScene[]>(
    TEMPLATES[0]!.defaultScenes.map((s) => ({ ...s })),
  );

  const { data: company } = useCompany(companyId);

  // Só preenche campo ainda vazio -- nunca sobrescreve o que você digitou.
  // A URL NÃO vem daqui: o tipo `Company` não tem site (os endereços vivem na
  // relação CompanyWebsite, que o `useCompany` não devolve).
  useEffect(() => {
    if (!company) return;
    setBusinessName((atual) => atual || company.name);
    setSegment((atual) => atual || company.segment || "");
  }, [company]);

  const template = templateById(templateId)!;

  function trocarTemplate(id: string) {
    const novo = templateById(id);
    if (!novo) return;
    setTemplateId(id);
    setScenes(scaleDurations(novo.defaultScenes.map((s) => ({ ...s })), totalDurationSec));
  }

  function redistribuir(alvo: TotalDuration) {
    setTotalDurationSec(alvo);
    setScenes(scaleDurations(scenes, alvo));
  }

  const { prompt, erro } = useMemo(() => {
    try {
      const brief = buildBrief(
        {
          businessName,
          url,
          segment,
          templateId,
          totalDurationSec,
          format,
          scenes,
          narrationMode: "auto",
          narrationText: "",
          customInstructions: "",
        },
        template,
        new Date().toISOString(),
      );
      return { prompt: buildPrompt(brief, template), erro: null as string | null };
    } catch (err) {
      return { prompt: "", erro: err instanceof Error ? err.message : String(err) };
    }
  }, [businessName, url, segment, templateId, totalDurationSec, format, scenes, template]);

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    toast.success("Prompt copiado");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <div className="space-y-2">
          <Label>Puxar de uma empresa cadastrada (opcional)</Label>
          <CompanyCombobox value={companyId} onChange={(id) => setCompanyId(id)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="empresa">Empresa</Label>
          <Input id="empresa" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">URL do site</Label>
          <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="segmento">Segmento (opcional)</Label>
          <Input id="segmento" value={segment} onChange={(e) => setSegment(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={trocarTemplate}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
          <div className="space-y-2">
            <Label>Duração</Label>
            <Select
              value={String(totalDurationSec)}
              onValueChange={(v) => redistribuir(Number(v) as TotalDuration)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURACOES.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Formato</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMATOS.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Cenas</Label>
            <span className="text-sm text-muted-foreground">
              {totalDuration(scenes)}s · {totalWordBudget(scenes)} palavras
            </span>
          </div>
          <SceneList scenes={scenes} onChange={setScenes} />
          <Button variant="outline" size="sm" onClick={() => redistribuir(totalDurationSec)}>
            Redistribuir para {totalDurationSec}s
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Prompt</h2>
          <Button size="sm" onClick={copiar} disabled={!prompt}>Copiar</Button>
        </div>
        {erro ? (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">{erro}</p>
        ) : (
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
            {prompt}
          </pre>
        )}
      </section>
    </div>
  );
}
