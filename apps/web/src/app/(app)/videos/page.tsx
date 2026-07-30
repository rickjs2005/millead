"use client";

import type { Snapshot } from "@millead/video-contracts";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCompany } from "@/features/companies/hooks";
import { buildBrief, scaleDurations, totalDuration, totalWordBudget } from "@/features/video-studio/build-brief";
import {
  buildCapturePrompt,
  capturePromptFileName,
} from "@/features/video-studio/build-capture-prompt";
import { buildPrompt, promptFileName } from "@/features/video-studio/build-prompt";
import {
  buildRenderPrompt,
  renderPromptFileName,
} from "@/features/video-studio/build-render-prompt";
import { type LoadedSnapshot, SnapshotInput } from "@/features/video-studio/components/snapshot-input";
import { NarrationFields } from "@/features/video-studio/components/narration-fields";
import { SceneList } from "@/features/video-studio/components/scene-list";
import { sectionsFromSnapshot } from "@/features/video-studio/from-snapshot";
import { matchTemplate } from "@/features/video-studio/match-template";
import { TEMPLATES, templateById } from "@/features/video-studio/templates";
import type {
  FormScene,
  NarrationMode,
  SiteFormScene,
  TotalDuration,
  VideoFormat,
} from "@/features/video-studio/types";

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
  const [narrationMode, setNarrationMode] = useState<NarrationMode>("auto");
  const [narrationText, setNarrationText] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  // Captura do crawler: sem ela, cena de site não existe -- só cena de
  // estúdio. `thumbs` mapeia "sections/x.jpg" (o mesmo caminho de
  // `screenshot`) para uma `blob:` URL local, entregue pelo `SnapshotInput`.
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map());
  // `chave` de cada `want` do template que a última "Aplicar sugestão" não
  // achou no site -- relatado num aviso âmbar, não escondido.
  const [naoEncontrados, setNaoEncontrados] = useState<string[]>([]);

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

  // Só troca o template escolhido -- NÃO mexe em `scenes` (que pode ter cena
  // de site já casada com a captura). Para popular/repovoar a timeline a
  // partir do template, use "Aplicar sugestão do template".
  function trocarTemplate(id: string) {
    const novo = templateById(id);
    if (!novo) return;
    setTemplateId(novo.id);
  }

  /**
   * Casa os `wants` do template com as seções REAIS da captura (nenhuma, se
   * não houver captura ainda -- `matchTemplate` lida bem com isso: as cenas
   * de estúdio entram do mesmo jeito, e todo `want` some em `naoEncontrados`).
   */
  function aplicarSugestaoDoTemplate() {
    const secoes = snapshot ? sectionsFromSnapshot(snapshot) : [];
    const resultado = matchTemplate(template, secoes);
    setScenes(scaleDurations(resultado.scenes, totalDurationSec));
    setNaoEncontrados(resultado.naoEncontrados);
  }

  /**
   * Uma cena de site por SEÇÃO REAL da captura -- não só as que o template
   * pediu (isso é o que "Aplicar sugestão do template" faz). Preserva as
   * cenas de estúdio já na timeline, reinserindo o bloco de site na posição
   * que o template atual indica.
   */
  function onSnapshotLoaded({ snapshot: novoSnapshot, thumbs: novosThumbs }: LoadedSnapshot) {
    setSnapshot(novoSnapshot);
    setThumbs(novosThumbs);
    setNaoEncontrados([]);
    setBusinessName((atual) => atual || novoSnapshot.page.title);
    setUrl((atual) => atual || novoSnapshot.url);

    const cenasDeSite: SiteFormScene[] = sectionsFromSnapshot(novoSnapshot).map((secao) => ({
      id: `site-${secao.sectionId}`,
      kind: "site",
      enabled: true,
      durationSec: 3,
      sectionId: secao.sectionId,
      label: secao.label,
      screenshot: secao.screenshot,
      sourceNodeId: secao.nodeId,
      zoomTargets: [],
    }));

    setScenes((atuais) => {
      const cenasDeEstudio = atuais.filter((s) => s.kind === "studio");
      const antes = cenasDeEstudio.slice(0, template.siteInsertAt);
      const depois = cenasDeEstudio.slice(template.siteInsertAt);
      return [...antes, ...cenasDeSite, ...depois];
    });
  }

  function redistribuir(alvo: TotalDuration) {
    setTotalDurationSec(alvo);
    setScenes(scaleDurations(scenes, alvo));
  }

  const { prompt, brief, erro } = useMemo(() => {
    try {
      const gerado = buildBrief(
        {
          businessName,
          url,
          segment,
          templateId,
          totalDurationSec,
          format,
          scenes,
          snapshotId: snapshot?.id,
          narrationMode,
          narrationText,
          customInstructions,
        },
        template,
        new Date().toISOString(),
      );
      return {
        prompt: buildPrompt(gerado, template),
        brief: gerado,
        erro: null as string | null,
      };
    } catch (err) {
      return {
        prompt: "",
        brief: null,
        erro: err instanceof Error ? err.message : String(err),
      };
    }
  }, [
    businessName,
    url,
    segment,
    templateId,
    totalDurationSec,
    format,
    scenes,
    snapshot,
    template,
    narrationMode,
    narrationText,
    customInstructions,
  ]);

  // Prompt de gravação: não depende de narração, então é derivado do brief
  // direto. Vazio quando o brief não existe (formulário ainda inválido).
  const capturePrompt = useMemo(() => (brief ? buildCapturePrompt(brief) : ""), [brief]);
  const renderPrompt = useMemo(() => (brief ? buildRenderPrompt(brief) : ""), [brief]);

  async function copiar(conteudo: string, oQue: string) {
    await navigator.clipboard.writeText(conteudo);
    toast.success(`${oQue} copiado`);
  }

  function baixar(conteudo: string, nome: string, tipo: string) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    // Safari e Firefox podem cancelar o download se a URL for revogada antes
    // do clique terminar de ser processado; Chrome tolera, mas o adiamento
    // com setTimeout(0) é seguro nos três.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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

        <SnapshotInput onLoaded={onSnapshotLoaded} />

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
            <Button variant="outline" size="sm" onClick={aplicarSugestaoDoTemplate}>
              Aplicar sugestão do template
            </Button>
            {naoEncontrados.length > 0 && (
              <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sm">
                O site não tem o que o template pede para: {naoEncontrados.join(", ")}.
              </p>
            )}
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
          {!snapshot && (
            <p className="text-sm text-muted-foreground">
              Cena de site exige uma captura. Rode <code>pnpm capture &lt;url&gt;</code> e escolha a
              pasta acima.
            </p>
          )}
          <SceneList scenes={scenes} onChange={setScenes} snapshot={snapshot} thumbs={thumbs} />
          <Button variant="outline" size="sm" onClick={() => redistribuir(totalDurationSec)}>
            Redistribuir para {totalDurationSec}s
          </Button>
        </div>

        <NarrationFields
          mode={narrationMode}
          text={narrationText}
          customInstructions={customInstructions}
          wordBudget={totalWordBudget(scenes)}
          onChange={(patch) => {
            if (patch.mode !== undefined) setNarrationMode(patch.mode);
            if (patch.text !== undefined) setNarrationText(patch.text);
            if (patch.customInstructions !== undefined) setCustomInstructions(patch.customInstructions);
          }}
        />
      </section>

      <section className="space-y-3">
        {erro ? (
          <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">{erro}</p>
        ) : (
          <Tabs defaultValue="prompt">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="prompt">Narração</TabsTrigger>
                <TabsTrigger value="gravacao">Gravação</TabsTrigger>
                <TabsTrigger value="montagem">Montagem</TabsTrigger>
                <TabsTrigger value="brief">Brief</TabsTrigger>
              </TabsList>
              <span className="text-sm text-muted-foreground">
                {brief!.totalDurationSec}s · {brief!.wordBudget} palavras
              </span>
            </div>

            <TabsContent value="prompt" className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => copiar(prompt, "Prompt de narração")}>
                  Copiar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => baixar(prompt, promptFileName(brief!), "text/markdown")}
                >
                  Baixar .md
                </Button>
              </div>
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                {prompt}
              </pre>
            </TabsContent>

            <TabsContent value="gravacao" className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => copiar(capturePrompt, "Prompt de gravação")}>
                  Copiar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    baixar(capturePrompt, capturePromptFileName(brief!), "text/markdown")
                  }
                >
                  Baixar .md
                </Button>
              </div>
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                {capturePrompt}
              </pre>
            </TabsContent>

            <TabsContent value="montagem" className="space-y-3">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => copiar(renderPrompt, "Prompt de montagem")}>
                  Copiar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => baixar(renderPrompt, renderPromptFileName(brief!), "text/markdown")}
                >
                  Baixar .md
                </Button>
              </div>
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                {renderPrompt}
              </pre>
            </TabsContent>

            <TabsContent value="brief" className="space-y-3">
              <Button
                size="sm"
                onClick={() =>
                  baixar(
                    `${JSON.stringify(brief, null, 2)}\n`,
                    `videobrief-${brief!.id}.json`,
                    "application/json",
                  )
                }
              >
                Baixar videobrief.json
              </Button>
              <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm">
                {JSON.stringify(brief, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        )}
      </section>
    </div>
  );
}
