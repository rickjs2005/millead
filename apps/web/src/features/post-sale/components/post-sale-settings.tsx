"use client";

import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useBriefingTemplates } from "@/features/briefings/hooks";
import { usePipelines } from "@/features/pipeline/hooks";
import {
  useOrganizationMembers,
  usePostSaleSettings,
  useUpdatePostSaleSettings,
} from "@/features/post-sale/hooks";
import { useAuthStore } from "@/stores/auth-store";
import type { UpdatePostSaleSettingsPayload } from "@/services/post-sale";
import type { PostSaleAutomationSettings, ProjectChecklistType } from "@/types/api";

/** `<Select>` do Radix não aceita `value=""`; este sentinela representa
 *  "nada escolhido" e vira `null` no payload (= limpar o campo na API). */
const NONE = "__none__";

/** Estado do formulário: tudo string, porque é o que os inputs entregam. O
 *  parse pra número/null acontece uma vez só, na hora de montar o payload. */
interface FormState {
  enabled: boolean;
  wonStageId: string;
  briefingTemplateKey: string;
  projectType: string;
  defaultOwnerId: string;
  createReceivables: boolean;
  installmentCount: string;
  entryDueDays: string;
  firstInstallmentDueDays: string;
  createBriefing: boolean;
  createProject: boolean;
}

function toForm(settings: PostSaleAutomationSettings): FormState {
  return {
    enabled: settings.enabled,
    wonStageId: settings.wonStageId ?? NONE,
    briefingTemplateKey: settings.briefingTemplateKey ?? NONE,
    projectType: settings.projectType ?? NONE,
    defaultOwnerId: settings.defaultOwnerId ?? NONE,
    createReceivables: settings.createReceivables,
    installmentCount: settings.installmentCount?.toString() ?? "",
    entryDueDays: settings.entryDueDays?.toString() ?? "",
    firstInstallmentDueDays: settings.firstInstallmentDueDays?.toString() ?? "",
    createBriefing: settings.createBriefing,
    createProject: settings.createProject,
  };
}

/** Campo vazio vira `null` (= "não configurado"), NUNCA 0 nem um default
 *  plausível: é justamente essa distinção que faz a automação criar uma
 *  pendência em vez de inventar o plano financeiro do cliente. */
function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function toPayload(form: FormState): UpdatePostSaleSettingsPayload {
  return {
    enabled: form.enabled,
    wonStageId: form.wonStageId === NONE ? null : form.wonStageId,
    briefingTemplateKey: form.briefingTemplateKey === NONE ? null : form.briefingTemplateKey,
    projectType: form.projectType === NONE ? null : (form.projectType as ProjectChecklistType),
    defaultOwnerId: form.defaultOwnerId === NONE ? null : form.defaultOwnerId,
    createReceivables: form.createReceivables,
    installmentCount: toNumberOrNull(form.installmentCount),
    entryDueDays: toNumberOrNull(form.entryDueDays),
    firstInstallmentDueDays: toNumberOrNull(form.firstInstallmentDueDays),
    createBriefing: form.createBriefing,
    createProject: form.createProject,
  };
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export function PostSaleSettings() {
  const canManage = useAuthStore((s) => s.hasPermission)("settings:manage");
  const { data, isLoading, isError, refetch } = usePostSaleSettings();
  const { data: pipelines } = usePipelines();
  const { data: templates } = useBriefingTemplates();
  const { data: members } = useOrganizationMembers();
  const update = useUpdatePostSaleSettings();

  const [form, setForm] = useState<FormState | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  // Ajuste de estado durante o render (padrão documentado do React pra
  // "estado derivado que precisa ressincronizar"), e não um useEffect: com
  // efeito, `data` teria que entrar nas dependências, e a IDENTIDADE dele
  // muda a cada refetch do React Query -- o formulário resetaria no meio da
  // digitação toda vez que a janela ganhasse foco. A chave é o `updatedAt`,
  // que só muda quando a configuração muda de verdade no servidor.
  if (data && syncedAt !== data.settings.updatedAt) {
    setSyncedAt(data.settings.updatedAt);
    setForm(toForm(data.settings));
  }

  if (!canManage) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Sem permissão"
        description="Só quem tem a permissão settings:manage pode ver e alterar a automação pós-fechamento."
      />
    );
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) return <ErrorState onRetry={() => refetch()} className="py-20" />;

  const stages = (pipelines ?? []).flatMap((pipeline) =>
    pipeline.stages.map((stage) => ({ ...stage, pipelineName: pipeline.name })),
  );
  const wonStages = stages.filter((stage) => stage.isWon);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(toPayload(form));
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Automação pós-fechamento</CardTitle>
          <CardDescription>
            Quando um contrato é assinado, o MilLead marca o lead como ganho, prepara os
            recebimentos, cria o briefing e o projeto e abre as próximas tarefas — tudo
            registrado na linha do tempo do contrato.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleRow
            id="post-sale-enabled"
            label="Ativar automação"
            description="Desligada, o contrato assinado não dispara nada — o comportamento de hoje."
            checked={form.enabled}
            onChange={(value) => set("enabled", value)}
          />

          {data && data.missing.length > 0 && (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/5 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Falta configurar</p>
                <p className="text-xs text-muted-foreground">
                  Estas etapas vão virar tarefa em vez de rodar sozinhas:{" "}
                  {data.missing.join(", ")}.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="won-stage">Estágio de ganho</Label>
              <Select value={form.wonStageId} onValueChange={(v) => set("wonStageId", v)}>
                <SelectTrigger id="won-stage">
                  <SelectValue placeholder="Escolher estágio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não configurado</SelectItem>
                  {wonStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.pipelineName} · {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {wonStages.length === 0
                  ? "Nenhum estágio está marcado como ganho — marque um em Configurações > Pipeline."
                  : "Pra onde o lead vai quando o contrato é assinado."}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="default-owner">Responsável padrão</Label>
              <Select value={form.defaultOwnerId} onValueChange={(v) => set("defaultOwnerId", v)}>
                <SelectTrigger id="default-owner">
                  <SelectValue placeholder="Escolher responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não configurado</SelectItem>
                  {(members ?? []).map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.name} · {member.roleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Assume o projeto, o briefing e as tarefas criadas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recebimentos</CardTitle>
          <CardDescription>
            A entrada sai do percentual do próprio contrato. Os prazos e o número de parcelas
            são decisão sua — em branco, a automação abre a tarefa &ldquo;Definir plano de
            recebimento&rdquo; em vez de arbitrar valores.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleRow
            id="create-receivables"
            label="Criar plano de recebimento"
            description="Gera entrada + parcelas assim que o contrato é assinado."
            checked={form.createReceivables}
            onChange={(value) => set("createReceivables", value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="installment-count">Parcelas (além da entrada)</Label>
              <Input
                id="installment-count"
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                placeholder="ex.: 2"
                value={form.installmentCount}
                disabled={!form.createReceivables}
                onChange={(e) => set("installmentCount", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="entry-due-days">Vencimento da entrada (dias)</Label>
              <Input
                id="entry-due-days"
                type="number"
                inputMode="numeric"
                min={0}
                max={730}
                placeholder="ex.: 3"
                value={form.entryDueDays}
                disabled={!form.createReceivables}
                onChange={(e) => set("entryDueDays", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="first-installment-days">1ª parcela (dias)</Label>
              <Input
                id="first-installment-days"
                type="number"
                inputMode="numeric"
                min={0}
                max={730}
                placeholder="ex.: 30"
                value={form.firstInstallmentDueDays}
                disabled={!form.createReceivables}
                onChange={(e) => set("firstInstallmentDueDays", e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Os dias contam a partir da data de assinatura do contrato.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Briefing e projeto</CardTitle>
          <CardDescription>
            O briefing nasce com link público pronto, mas nada é enviado ao cliente
            automaticamente — quem envia é você.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ToggleRow
            id="create-briefing"
            label="Criar briefing"
            description="Vinculado ao lead, à empresa e ao contrato."
            checked={form.createBriefing}
            onChange={(value) => set("createBriefing", value)}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="briefing-template">Template padrão de briefing</Label>
            <Select
              value={form.briefingTemplateKey}
              onValueChange={(v) => set("briefingTemplateKey", v)}
            >
              <SelectTrigger id="briefing-template" disabled={!form.createBriefing}>
                <SelectValue placeholder="Escolher template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não configurado</SelectItem>
                {(templates ?? []).map((template) => (
                  <SelectItem key={template.key} value={template.key}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ToggleRow
            id="create-project"
            label="Criar projeto"
            description="Checklist com as 16 fases do tipo escolhido, nomeado com empresa e número do contrato."
            checked={form.createProject}
            onChange={(value) => set("createProject", value)}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-type">Tipo padrão de projeto</Label>
            <Select value={form.projectType} onValueChange={(v) => set("projectType", v)}>
              <SelectTrigger id="project-type" disabled={!form.createProject}>
                <SelectValue placeholder="Escolher tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Não configurado</SelectItem>
                <SelectItem value="INSTITUTIONAL">Institucional / landing</SelectItem>
                <SelectItem value="SYSTEM">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />}
          {update.isPending ? "Salvando…" : "Salvar automação"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={update.isPending}
          onClick={() => data && setForm(toForm(data.settings))}
          title="Volta o formulário para a última configuração salva"
        >
          Descartar alterações
        </Button>
      </div>
    </form>
  );
}
