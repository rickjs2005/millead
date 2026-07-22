"use client";

import { Check, Copy, Download, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { useBriefing, useBriefings } from "@/features/briefings/hooks";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCompany } from "@/features/companies/hooks";
import { briefingToPromptPrefill } from "@/features/prompt-builder/briefing-prefill";
import { buildPrompt, type PromptInput } from "@/features/prompt-builder/build-prompt";
import {
  ANIMATIONS,
  DEFAULT_SECTIONS,
  DESIGN_STYLES,
  EFFECTS,
  FRAMEWORKS,
  findOption,
  GOALS,
  LANGUAGES,
  SECTIONS,
} from "@/features/prompt-builder/options";
import { cn } from "@/lib/utils";

const EMPTY: PromptInput = {
  businessName: "",
  segment: "",
  description: "",
  audience: "",
  differentials: "",
  location: "",
  contact: "",
  goal: "whatsapp",
  contentLanguage: "Português (Brasil)",
  designStyle: "minimalista",
  palette: "",
  references: "",
  framework: "next-tailwind",
  language: "typescript",
  animation: "subtle",
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

export default function PromptBuilderPage() {
  const [companyId, setCompanyId] = useState<string | undefined>();
  const [briefingId, setBriefingId] = useState<string | undefined>();
  const [form, setForm] = useState<PromptInput>(EMPTY);
  const [copied, setCopied] = useState(false);

  const { data: company } = useCompany(companyId);
  // Briefings CONCLUÍDOS: o cliente já contou tudo lá — fonte ideal do prompt.
  const { data: completedBriefings } = useBriefings({ status: "COMPLETED", pageSize: 50 });
  const { data: briefing } = useBriefing(briefingId);

  // Prefill a partir da empresa selecionada -- só preenche campos ainda vazios,
  // pra não apagar o que o usuário já digitou.
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

  // Prefill a partir das RESPOSTAS do briefing selecionado (mesma regra:
  // só preenche o que ainda está vazio).
  useEffect(() => {
    if (!briefing) return;
    const prefill = briefingToPromptPrefill(briefing);
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(prefill) as [
        keyof PromptInput,
        PromptInput[keyof PromptInput],
      ][]) {
        if (typeof value === "string" && !next[key]) {
          (next as Record<string, unknown>)[key] = value;
        }
      }
      return next;
    });
  }, [briefing]);

  function set<K extends keyof PromptInput>(key: K, value: PromptInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSection(value: string) {
    setForm((prev) => ({
      ...prev,
      sections: prev.sections.includes(value)
        ? prev.sections.filter((s) => s !== value)
        : [...prev.sections, value],
    }));
  }

  function toggleEffect(value: string) {
    setForm((prev) => ({
      ...prev,
      effects: prev.effects.includes(value)
        ? prev.effects.filter((e) => e !== value)
        : [...prev.effects, value],
    }));
  }

  const styleRef = findOption(DESIGN_STYLES, form.designStyle)?.reference;

  const prompt = useMemo(() => buildPrompt(form), [form]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copiado! Cole no ChatGPT ou Claude.");
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadPrompt() {
    const blob = new Blob([prompt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-${(form.businessName || "site").toLowerCase().replace(/\s+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gerador de prompt de site</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados do cliente, escolha o estilo e a stack, e gere um prompt pronto pra
          colar no ChatGPT ou Claude.
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
                hint="Opcional — usa as respostas que o cliente deu no formulário; preenche os campos vazios."
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
              <Field label="Contato (WhatsApp / e-mail)">
                <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">2. Objetivo e design</p>
              <Field label="Objetivo da página">
                <OptionSelect value={form.goal} onChange={(v) => set("goal", v)} options={GOALS} />
              </Field>
              <Field label="Estilo visual" hint={styleRef ? `Referências: ${styleRef}` : undefined}>
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
                    placeholder="ex.: verde e branco"
                  />
                </Field>
                <Field label="Idioma do conteúdo">
                  <Input
                    value={form.contentLanguage}
                    onChange={(e) => set("contentLanguage", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Referências" hint="Opcional — sites ou marcas de inspiração.">
                <Input
                  value={form.references}
                  onChange={(e) => set("references", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">3. Stack técnica</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Framework / biblioteca">
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
              <Field label="Animações">
                <OptionSelect
                  value={form.animation}
                  onChange={(v) => set("animation", v)}
                  options={ANIMATIONS}
                />
              </Field>
              <Field
                label="Recursos avançados"
                hint="Opcional — some ao prompt. Ex.: 3D com Three.js, shaders, Lottie."
              >
                <div className="flex flex-wrap gap-2">
                  {EFFECTS.map((ef) => {
                    const active = form.effects.includes(ef.value);
                    return (
                      <button
                        key={ef.value}
                        type="button"
                        onClick={() => toggleEffect(ef.value)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {active && <Check className="mr-1 inline h-3 w-3" />}
                        {ef.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              <p className="text-sm font-semibold">4. Seções</p>
              <div className="flex flex-wrap gap-2">
                {SECTIONS.map((s) => {
                  const active = form.sections.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSection(s.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {active && <Check className="mr-1 inline h-3 w-3" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <Field
                label="Observações adicionais"
                hint="Opcional — qualquer instrução extra pra IA."
              >
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* ---- Preview do prompt ---- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" />
                Prompt gerado
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadPrompt}>
                  <Download className="h-3.5 w-3.5" /> Baixar
                </Button>
                <Button size="sm" onClick={copyPrompt}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
            <pre className="max-h-[calc(100dvh-11rem)] overflow-auto whitespace-pre-wrap px-5 py-4 text-[13px] leading-relaxed text-foreground">
              {prompt}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
