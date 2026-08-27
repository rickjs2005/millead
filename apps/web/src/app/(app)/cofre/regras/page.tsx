"use client";

import { ListFilter, Plus, Wand2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useVaultCategories, useVaultMerchants } from "@/features/vault/finance-hooks";
import {
  useCreateVaultRule,
  useDeleteVaultRule,
  useRunClassification,
  useUpdateVaultRule,
  useVaultRules,
} from "@/features/vault/subscription-hooks";
import type { VaultRuleMatchType } from "@/types/api";

const MATCH_LABELS: Record<VaultRuleMatchType, string> = {
  CONTAINS: "contém",
  STARTS_WITH: "começa com",
  EXACT: "é exatamente",
};

/**
 * Regras de classificação.
 *
 * A ordem é explícita (`prioridade`, menor roda primeiro) e não a de criação:
 * "IFOOD ESTACIONAMENTO → Transporte" precisa ser avaliada antes de
 * "IFOOD → Delivery", e isso não tem relação com qual você criou primeiro.
 */
export default function CofreRegrasPage() {
  const [incluirInativas, setIncluirInativas] = useState(false);
  const rules = useVaultRules(incluirInativas);
  const update = useUpdateVaultRule();
  const remove = useDeleteVaultRule();
  const run = useRunClassification();
  const merchants = useVaultMerchants();
  const categories = useVaultCategories();

  const nomeCategoria = (id: string | null) => {
    if (!id) return null;
    for (const root of categories.data ?? []) {
      if (root.id === id) return root.name;
      const child = root.children.find((c) => c.id === id);
      if (child) return `${root.name} / ${child.name}`;
    }
    return null;
  };
  const nomeFornecedor = (id: string | null) =>
    id ? ((merchants.data ?? []).find((m) => m.id === id)?.name ?? null) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="regras-inativas"
            checked={incluirInativas}
            onCheckedChange={setIncluirInativas}
          />
          <Label htmlFor="regras-inativas" className="text-sm font-normal text-muted-foreground">
            Mostrar inativas
          </Label>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => run.mutate(undefined)}
            disabled={run.isPending}
          >
            <Wand2 /> {run.isPending ? "Classificando…" : "Classificar pendentes"}
          </Button>
          <NovaRegraDialog />
        </div>
      </div>

      {rules.isPending && <Skeleton className="h-40 w-full" />}

      {!rules.isPending && (rules.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={ListFilter}
          title="Nenhuma regra criada"
          description="Você também cria regras ao corrigir uma movimentação — a opção 'criar regra para as próximas' aparece lá."
        />
      )}

      <ul className="space-y-2">
        {(rules.data ?? []).map((rule) => (
          <li
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  {rule.priority}
                </Badge>
                <span className="text-sm font-medium">{rule.name ?? "Regra sem nome"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Se a descrição {MATCH_LABELS[rule.matchType ?? "CONTAINS"]}{" "}
                <span className="font-mono">{rule.matchValue ?? "—"}</span>
                {" → "}
                {[
                  nomeFornecedor(rule.setMerchantId),
                  nomeCategoria(rule.setCategoryId),
                  rule.businessPercent && `${rule.businessPercent}% empresarial`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={rule.isActive}
                aria-label={`Ativar regra ${rule.name ?? rule.id}`}
                onCheckedChange={(isActive) => update.mutate({ id: rule.id, isActive })}
              />
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => remove.mutate(rule.id)}
              >
                Remover
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Prioridade menor roda primeiro. Uma regra precisa de pelo menos uma condição e uma ação — a
        API recusa regra vazia, que casaria com todas as movimentações do Cofre.
      </p>
    </div>
  );
}

function NovaRegraDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateVaultRule();
  const merchants = useVaultMerchants();
  const categories = useVaultCategories();

  const [form, setForm] = useState({
    name: "",
    priority: "100",
    matchType: "CONTAINS" as VaultRuleMatchType,
    matchValue: "",
    setMerchantId: "",
    setCategoryId: "",
    businessPercent: "",
  });

  async function submit() {
    await create.mutateAsync({
      name: form.name.trim() || null,
      priority: Number(form.priority),
      matchType: form.matchType,
      matchValue: form.matchValue.trim(),
      matchMerchantId: null,
      matchAccountId: null,
      matchCardId: null,
      matchAmountMin: null,
      matchAmountMax: null,
      setMerchantId: form.setMerchantId || null,
      setCategoryId: form.setCategoryId || null,
      setSubscriptionId: null,
      businessPercent: form.businessPercent.trim() || null,
    });
    setOpen(false);
  }

  const temAcao = form.setMerchantId || form.setCategoryId || form.businessPercent.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nova regra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova regra</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="regra-nome">Nome</Label>
              <Input
                id="regra-nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Claude"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regra-prio">Prioridade</Label>
              <Input
                id="regra-prio"
                inputMode="numeric"
                className="w-24"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="regra-tipo">Se a descrição</Label>
              <Select
                value={form.matchType}
                onValueChange={(matchType) =>
                  setForm({ ...form, matchType: matchType as VaultRuleMatchType })
                }
              >
                <SelectTrigger id="regra-tipo" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regra-valor">Texto</Label>
              <Input
                id="regra-valor"
                value={form.matchValue}
                onChange={(e) => setForm({ ...form, matchValue: e.target.value })}
                placeholder="ANTHROPIC"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="regra-forn">Então, fornecedor</Label>
              <Select
                value={form.setMerchantId}
                onValueChange={(setMerchantId) => setForm({ ...form, setMerchantId })}
              >
                <SelectTrigger id="regra-forn">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {(merchants.data ?? []).map((merchant) => (
                    <SelectItem key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="regra-cat">e categoria</Label>
              <Select
                value={form.setCategoryId}
                onValueChange={(setCategoryId) => setForm({ ...form, setCategoryId })}
              >
                <SelectTrigger id="regra-cat">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).flatMap((root) => [
                    <SelectItem key={root.id} value={root.id}>
                      {root.name}
                    </SelectItem>,
                    ...root.children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {root.name} / {child.name}
                      </SelectItem>
                    )),
                  ])}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="regra-pct">Percentual empresarial</Label>
            <Input
              id="regra-pct"
              inputMode="decimal"
              className="w-32"
              value={form.businessPercent}
              onChange={(e) => setForm({ ...form, businessPercent: e.target.value })}
              placeholder="100"
            />
            <p className="text-[11px] text-muted-foreground">
              Quanto desta cobrança é despesa da MilWeb. Percentual, e não valor: o valor muda a
              cada cobrança, a proporção não.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!form.matchValue.trim() || !temAcao || create.isPending}
          >
            {create.isPending ? "Criando…" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
