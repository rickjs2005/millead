"use client";

import { Check, Copy, Download, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAiStatus } from "@/features/ai/hooks";
import { useBriefing, useBriefings } from "@/features/briefings/hooks";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCompany } from "@/features/companies/hooks";
import { briefingToPrefill } from "@/features/creative-director/briefing-prefill";
import { buildDossier, dossierFileName } from "@/features/creative-director/build-dossier";
import { useCreativeDirection } from "@/features/creative-director/hooks";
import {
  ANIMATIONS,
  ARCHETYPES,
  DEFAULT_SECTIONS,
  DESIGN_STYLES,
  EFFECTS,
  EMOTIONS,
  FRAMEWORKS,
  GOALS,
  LANGUAGES,
  SCALES,
  SECTIONS,
  findOption,
  scaleLevel,
} from "@/features/creative-director/options";
import type { CreativeDirection, CreativeInput } from "@/features/creative-director/types";
import { cn } from "@/lib/utils";

const EMPTY: CreativeInput = {
  businessName: "",
  segment: "",
  description: "",
  audience: "",
  differentials: "",
  location: "",
  contact: "",
  competitors: "",
  averageTicket: "",
  goal: "whatsapp",
  contentLanguage: "Português (Brasil)",
  emotion: "confianca",
  archetype: "criador",
  luxury: 2,
  boldness: 2,
  motion: 3,
  videoWeight: 2,
  designStyle: "auto",
  palette: "",
  references: "",
  framework: "next-tailwind",
  language: "typescript",
  animation: "gsap",
  effects: [],
  sections: DEFAULT_SECTIONS,
  notes: "",
};

function OptionSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Slider 0..4 com o texto do nível embaixo -- o texto é o que vai pro dossiê. */
function ScaleField({
  scaleKey,
  value,
  onChange,
}: {
  scaleKey: (typeof SCALES)[number]["key"];
  value: number;
  onChange: (v: number) => void;
}) {
  const scale = SCALES.find((s) => s.key === scaleKey)!;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <Label>{scale.label}</Label>
        <span className="text-xs text-muted-foreground">
          {scale.min} ↔ {scale.max}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={scale.label}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <p className="text-xs text-muted-foreground">{scaleLevel(scale, value)}</p>
    </div>
  );
}

function Chips({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {active && <Check className="mr-1 inline h-3 w-3" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CreativeDirectorPage() {
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [briefingId, setBriefingId] = useState<string | undefined>();
  const [form, setForm] = useState<CreativeInput>(EMPTY);
  const [direction, setDirection] = useState<CreativeDirection | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const { data: company } = useCompany(companyId);
  // Briefings CONCLUÍDOS: o cliente já contou tudo lá -- fonte ideal do dossiê.
  const { data: completedBriefings } = useBriefings({ status: "COMPLETED", pageSize: 50 });
  const { data: briefing } = useBriefing(briefingId);
  const { data: aiStatus } = useAiStatus();
  const directCreative = useCreativeDirection();

  // Prefill por empresa -- só preenche campos ainda vazios.
  useEffect(() => {
    if (!company) return;
    setForm((prev) => ({
      ...prev,
      businessName: prev.businessName || company.name,
      segment: prev.segment || company.segment || "",
      location: prev.location || [company.city, company.state].filter(Boolean).join(" / ") || "",
      description: prev.description || company.notes || "",
      contact: prev.contact || company.phone || company.email || "",
    }));
  }, [company]);

  // Prefill pelas RESPOSTAS do briefing -- mesma regra.
  useEffect(() => {
    if (!briefing) return;
    const prefill = briefingToPrefill(briefing);
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(prefill) as [
        keyof CreativeInput,
        CreativeInput[keyof CreativeInput],
      ][]) {
        if (typeof value === "string" && !next[key]) {
          (next as Record<string, unknown>)[key] = value;
        }
      }
      return next;
    });
  }, [briefing]);

  function set<K extends keyof CreativeInput>(key: K, value: CreativeInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggle(key: "sections" | "effects", value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));
  }

  const dossier = useMemo(() => buildDossier(form, direction), [form, direction]);
  const styleRef = findOption(DESIGN_STYLES, form.designStyle)?.reference;
  const aiEnabled = aiStatus?.enabled ?? false;

  async function copy(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado!");
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
  }

  function downloadAll() {
    const blob = new Blob([dossier.full], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = dossierFileName(form);
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateDirection() {
    const result = await directCreative.mutateAsync(form).catch(() => null);
    if (result) {
      setDirection(result);
      toast.success("Direção criativa aplicada ao dossiê.");
    }
  }

  function CopyButton({ id, text, label }: { id: string; text: string; label?: string }) {
    return (
      <Button variant="outline" size="sm" onClick={() => copy(id, text)}>
        {copied === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {label ?? (copied === id ? "Copiado" : "Copiar")}
      </Button>
    );
  }

  const paneClass =
    "max-h-[calc(100dvh-14rem)] overflow-auto whitespace-pre-wrap px-5 py-4 text-[13px] leading-relaxed text-foreground";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Diretor criativo</h1>
        <p className="text-sm text-muted-foreground">
          Conceito, storytelling, direção de arte, cenas de vídeo e arquitetura front-end — um
          dossiê pronto pra colar no Claude Code, no Higgsfield e nas IAs de imagem.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---- Formulário ---- */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">1. Cliente</p>
              <Field
                label="Puxar de um briefing concluído"
                hint="Opcional — usa as respostas do cliente; preenche só os campos vazios."
              >
                <Select
                  value={briefingId ?? "none"}
                  onValueChange={(v) => setBriefingId(v === "none" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum briefing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum briefing</SelectItem>
                    {(completedBriefings?.items ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {(b.contactName || b.contactEmail || "Sem nome") +
                          " — " +
                          new Date(b.completedAt ?? b.createdAt).toLocaleDateString("pt-BR")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Puxar de uma empresa" hint="Opcional — preenche os campos vazios.">
                <CompanyCombobox value={companyId} onChange={(id) => setCompanyId(id)} />
              </Field>
              <Field label="Nome do negócio">
                <Input
                  value={form.businessName}
                  onChange={(e) => set("businessName", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Segmento / nicho">
                  <Input value={form.segment} onChange={(e) => set("segment", e.target.value)} />
                </Field>
                <Field label="Localização">
                  <Input value={form.location} onChange={(e) => set("location", e.target.value)} />
                </Field>
              </div>
              <Field label="O que o negócio faz / oferece">
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
              <Field label="Público-alvo">
                <Input value={form.audience} onChange={(e) => set("audience", e.target.value)} />
              </Field>
              <Field label="Diferenciais">
                <Textarea
                  rows={2}
                  value={form.differentials}
                  onChange={(e) => set("differentials", e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Concorrentes diretos" hint="A IA não tem como adivinhar isso.">
                  <Input
                    value={form.competitors}
                    onChange={(e) => set("competitors", e.target.value)}
                    placeholder="ex.: Padaria Central, Empório do Pão"
                  />
                </Field>
                <Field label="Ticket médio" hint="Define o nível de prova e de sofisticação.">
                  <Input
                    value={form.averageTicket}
                    onChange={(e) => set("averageTicket", e.target.value)}
                    placeholder="ex.: R$ 2.000 por projeto"
                  />
                </Field>
              </div>
              <Field label="Contato (WhatsApp / e-mail)">
                <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">2. Intenção</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Objetivo da página">
                  <OptionSelect
                    value={form.goal}
                    onChange={(v) => set("goal", v)}
                    options={GOALS}
                  />
                </Field>
                <Field label="Idioma do conteúdo">
                  <Input
                    value={form.contentLanguage}
                    onChange={(e) => set("contentLanguage", e.target.value)}
                  />
                </Field>
                <Field label="Emoção-alvo">
                  <OptionSelect
                    value={form.emotion}
                    onChange={(v) => set("emotion", v)}
                    options={EMOTIONS}
                  />
                </Field>
                <Field label="Arquétipo de marca">
                  <OptionSelect
                    value={form.archetype}
                    onChange={(v) => set("archetype", v)}
                    options={ARCHETYPES}
                  />
                </Field>
              </div>
              <div className="grid gap-4 pt-1 sm:grid-cols-2">
                {SCALES.map((s) => (
                  <ScaleField
                    key={s.key}
                    scaleKey={s.key}
                    value={form[s.key]}
                    onChange={(v) => set(s.key, v)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">3. Direção visual</p>
              <Field
                label="Linguagem visual"
                hint={styleRef ? `Referências: ${styleRef}` : "A direção criativa decide o estilo."}
              >
                <OptionSelect
                  value={form.designStyle}
                  onChange={(v) => set("designStyle", v)}
                  options={DESIGN_STYLES}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Paleta / cores" hint="Opcional">
                  <Input
                    value={form.palette}
                    onChange={(e) => set("palette", e.target.value)}
                    placeholder="ex.: verde profundo e cru"
                  />
                </Field>
                <Field label="Referências" hint="Opcional — sites ou marcas de inspiração.">
                  <Input
                    value={form.references}
                    onChange={(e) => set("references", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">4. Arquitetura front-end</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Framework">
                  <OptionSelect
                    value={form.framework}
                    onChange={(v) => set("framework", v)}
                    options={FRAMEWORKS}
                  />
                </Field>
                <Field label="Linguagem">
                  <OptionSelect
                    value={form.language}
                    onChange={(v) => set("language", v)}
                    options={LANGUAGES}
                  />
                </Field>
              </div>
              <Field label="Animação base">
                <OptionSelect
                  value={form.animation}
                  onChange={(v) => set("animation", v)}
                  options={ANIMATIONS}
                />
              </Field>
              <Field
                label="Recursos avançados"
                hint="Opcional — entram no prompt como obrigatórios, com fallback exigido."
              >
                <Chips
                  options={EFFECTS}
                  selected={form.effects}
                  onToggle={(v) => toggle("effects", v)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">5. Estrutura</p>
              <Field label="Seções" hint="A ordem dos cliques é a ordem da página.">
                <Chips
                  options={SECTIONS}
                  selected={form.sections}
                  onToggle={(v) => toggle("sections", v)}
                />
              </Field>
              <Field label="Observações adicionais" hint="Opcional — qualquer instrução extra.">
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* ---- Dossiê ---- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Dossiê
                {direction ? (
                  <Badge variant="secondary">direção criativa aplicada</Badge>
                ) : (
                  <Badge variant="outline">modo grátis</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {aiEnabled ? (
                  <Button size="sm" onClick={generateDirection} disabled={directCreative.isPending}>
                    {directCreative.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    {directCreative.isPending
                      ? "Dirigindo…"
                      : direction
                        ? "Gerar de novo"
                        : "Direção criativa com IA"}
                  </Button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button size="sm" disabled>
                          <Wand2 className="h-3.5 w-3.5" />
                          Direção criativa com IA
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      IA não configurada no servidor (ANTHROPIC_API_KEY). O dossiê continua
                      funcionando no modo grátis.
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  <Download className="h-3.5 w-3.5" /> Baixar tudo
                </Button>
              </div>
            </div>

            {directCreative.isPending && (
              <p className="border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground">
                Analisando o negócio, criando o conceito e dirigindo as cenas. Costuma levar de 40 a
                90 segundos.
              </p>
            )}

            <Tabs defaultValue="concept" className="flex flex-col">
              <TabsList className="mx-5 mt-3 self-start">
                <TabsTrigger value="concept">Dossiê</TabsTrigger>
                <TabsTrigger value="code">Código</TabsTrigger>
                <TabsTrigger value="video">Vídeo</TabsTrigger>
                <TabsTrigger value="images">Imagens</TabsTrigger>
                <TabsTrigger value="checks">Checklists</TabsTrigger>
              </TabsList>

              <TabsContent value="concept" className="mt-0">
                <div className="flex justify-end px-5 pt-3">
                  <CopyButton id="concept" text={dossier.concept} />
                </div>
                <pre className={paneClass}>{dossier.concept}</pre>
              </TabsContent>

              <TabsContent value="code" className="mt-0">
                <div className="flex items-center justify-between gap-2 px-5 pt-3">
                  <p className="text-xs text-muted-foreground">Cole inteiro no Claude Code.</p>
                  <CopyButton id="code" text={dossier.codePrompt} />
                </div>
                <pre className={paneClass}>{dossier.codePrompt}</pre>
              </TabsContent>

              <TabsContent value="video" className="mt-0">
                <div className="flex justify-end px-5 pt-3">
                  <CopyButton id="video-intro" text={dossier.video.intro} label="Copiar briefing" />
                </div>
                <div className={cn(paneClass, "flex flex-col gap-4")}>
                  <span>{dossier.video.intro}</span>
                  {dossier.video.scenes.map((scene) => (
                    <div key={scene.ordem} className="rounded-lg border border-border p-4">
                      <p className="text-sm font-semibold">{scene.titulo}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {scene.duracaoSeg}s · {scene.integracaoComScroll}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CopyButton
                          id={`hf-${scene.ordem}`}
                          text={scene.higgsfield}
                          label="Higgsfield"
                        />
                        <CopyButton id={`veo-${scene.ordem}`} text={scene.veo} label="Veo" />
                        <CopyButton id={`rw-${scene.ordem}`} text={scene.runway} label="Runway" />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="images" className="mt-0">
                <div className="flex justify-end px-5 pt-3">
                  <CopyButton id="images" text={dossier.images} />
                </div>
                <pre className={paneClass}>{dossier.images}</pre>
              </TabsContent>

              <TabsContent value="checks" className="mt-0">
                <div className="flex justify-end px-5 pt-3">
                  <CopyButton id="checks" text={dossier.checklists} />
                </div>
                <pre className={paneClass}>{dossier.checklists}</pre>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
