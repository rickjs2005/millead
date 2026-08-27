"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useVaultCategories, useVaultMerchants } from "@/features/vault/finance-hooks";
import { useCorrectClassification } from "@/features/vault/subscription-hooks";
import type { VaultTransaction } from "@/types/api";
import { formatCurrency } from "@/utils/format";

/**
 * Correção de classificação, com a escolha combinada: **corrigir só esta** ou
 * **criar regra para as próximas**.
 *
 * Criar a regra não reclassifica o passado, e o texto do diálogo diz isso —
 * "para as próximas" precisa ser literal também na tela, senão a pessoa espera
 * que os lançamentos antigos mudem.
 */
export function ClassifyDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: VaultTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const correct = useCorrectClassification();
  const categories = useVaultCategories();
  const merchants = useVaultMerchants();

  const [categoryId, setCategoryId] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [businessPercent, setBusinessPercent] = useState("");
  const [criarRegra, setCriarRegra] = useState(false);
  const [matchValue, setMatchValue] = useState("");

  // Reabre limpo para cada movimentação: manter a escolha anterior faria a
  // pessoa classificar a linha errada sem perceber.
  const [ultimaId, setUltimaId] = useState<string | null>(null);
  if (transaction && transaction.id !== ultimaId) {
    setUltimaId(transaction.id);
    setCategoryId(transaction.categoryId ?? "");
    setMerchantId(transaction.merchantId ?? "");
    setBusinessPercent("");
    setCriarRegra(false);
    setMatchValue(transaction.normalizedDescription);
  }

  if (!transaction) return null;

  async function submit() {
    if (!transaction) return;
    await correct.mutateAsync({
      transactionId: transaction.id,
      categoryId: categoryId || null,
      merchantId: merchantId || null,
      businessPercent: businessPercent.trim() || null,
      createRule: criarRegra
        ? {
            name: null,
            matchType: "CONTAINS",
            matchValue: matchValue.trim(),
            priority: 100,
            scopeToOrigin: false,
          }
        : null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Classificar movimentação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium">{transaction.originalDescription}</div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(transaction.amountBrl)} ·{" "}
              {transaction.direction === "OUT" ? "saída" : "entrada"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="class-cat">Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="class-cat">
                  <SelectValue placeholder="Escolher" />
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

            <div className="space-y-1.5">
              <Label htmlFor="class-forn">Fornecedor</Label>
              <Select value={merchantId} onValueChange={setMerchantId}>
                <SelectTrigger id="class-forn">
                  <SelectValue placeholder="Opcional" />
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="class-pct">Percentual empresarial</Label>
            <Input
              id="class-pct"
              inputMode="decimal"
              className="w-32"
              value={businessPercent}
              onChange={(e) => setBusinessPercent(e.target.value)}
              placeholder="100"
            />
            <p className="text-[11px] text-muted-foreground">
              Vira uma divisão da MilWeb. Deixe em branco para não mexer no rateio.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="class-regra"
                checked={criarRegra}
                onCheckedChange={(checked) => setCriarRegra(checked === true)}
              />
              <div className="space-y-0.5">
                <Label htmlFor="class-regra" className="text-sm font-normal">
                  Criar regra para as próximas movimentações
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Vale daqui pra frente. Os lançamentos que você já revisou não mudam.
                </p>
              </div>
            </div>

            {criarRegra && (
              <div className="space-y-1.5 pl-6">
                <Label htmlFor="class-match">Quando a descrição contiver</Label>
                <Input
                  id="class-match"
                  value={matchValue}
                  onChange={(e) => setMatchValue(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Encurte para pegar as variações: <span className="font-mono">ANTHROPIC</span> pega
                  também <span className="font-mono">ANTHROPIC CLAUDE PRO</span>.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={correct.isPending || (criarRegra && !matchValue.trim())}
          >
            {correct.isPending ? "Salvando…" : criarRegra ? "Salvar e criar regra" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
