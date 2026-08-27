"use client";

import { Building2, RefreshCw, Send, Undo2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  usePushToBusiness,
  useRevertBusinessExpense,
  useSyncBusinessExpense,
  useVaultBridge,
  useVaultBridgePlans,
} from "@/features/vault/bridge-hooks";
import { formatVaultDate } from "@/features/vault/format";
import { CATEGORY_LABELS } from "@/features/finance/finance-labels";
import { formatCurrency } from "@/utils/format";
import type { VaultBridgeItem } from "@/types/api";

/**
 * A ponte com o financeiro da MilWeb.
 *
 * Mostra as compras pessoais que têm parte empresarial e o que já foi lançado
 * lá. O que atravessa é só a parte da empresa, com a descrição que você
 * escreve — nunca a linha crua do extrato, nunca o valor cheio da compra.
 */
export default function CofreMilWebPage() {
  const bridge = useVaultBridge();
  const [enviando, setEnviando] = useState<VaultBridgeItem | null>(null);

  const itens = bridge.data ?? [];
  const pendentes = itens.filter((i) => i.state === "NAO_ENVIADA");
  const desatualizadas = itens.filter((i) => i.state === "DESATUALIZADA");
  const totalPendente = pendentes.reduce((t, i) => t + Number(i.businessAmount), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm text-muted-foreground">
          Compras suas que têm uma parte da MilWeb. Ao enviar, o financeiro da empresa recebe{" "}
          <strong>só essa parte</strong> — com a descrição que você escrever. O resto da compra, a
          conta, o cartão e a fatura não atravessam.
        </p>
        {pendentes.length > 0 && (
          <p className="mt-2 text-sm">
            <strong>{formatCurrency(totalPendente)}</strong> em{" "}
            {pendentes.length === 1 ? "1 compra" : `${pendentes.length} compras`} ainda não{" "}
            {pendentes.length === 1 ? "foi lançada" : "foram lançadas"}.
          </p>
        )}
        {desatualizadas.length > 0 && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
            {desatualizadas.length === 1
              ? "1 lançamento está com valor diferente do rateio atual."
              : `${desatualizadas.length} lançamentos estão com valor diferente do rateio atual.`}
          </p>
        )}
      </div>

      {bridge.isPending && <Skeleton className="h-40 w-full" />}

      {!bridge.isPending && itens.length === 0 && (
        <EmptyState
          icon={Building2}
          title="Nenhuma compra com parte da MilWeb"
          description="Marque quanto de uma compra é da empresa no rateio da movimentação, e ela aparece aqui para ser lançada no financeiro."
        />
      )}

      <div className="space-y-3">
        {itens.map((item) => (
          <ItemCard key={item.transactionId} item={item} onEnviar={() => setEnviando(item)} />
        ))}
      </div>

      {enviando && <EnviarDialog item={enviando} onClose={() => setEnviando(null)} />}
    </div>
  );
}

const STATE_BADGE: Record<
  VaultBridgeItem["state"],
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  NAO_ENVIADA: { label: "Não enviada", variant: "secondary" },
  ENVIADA: { label: "No financeiro", variant: "outline" },
  DESATUALIZADA: { label: "Valor desatualizado", variant: "destructive" },
};

function ItemCard({ item, onEnviar }: { item: VaultBridgeItem; onEnviar: () => void }) {
  const sync = useSyncBusinessExpense();
  const revert = useRevertBusinessExpense();
  const badge = STATE_BADGE[item.state];

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{item.originalDescription}</span>
            <Badge variant={badge.variant} className="text-[10px]">
              {badge.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatVaultDate(item.transactionDate)} · compra de {formatCurrency(item.amountBrl)}
          </div>
          {item.sentDescription && (
            <div className="text-xs text-muted-foreground">
              No financeiro como: &ldquo;{item.sentDescription}&rdquo;
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">
            {formatCurrency(item.businessAmount)}
          </div>
          <div className="text-xs text-muted-foreground">parte da MilWeb</div>
        </div>
      </div>

      {item.state === "DESATUALIZADA" && (
        <p className="text-xs text-muted-foreground">
          Foi lançado {formatCurrency(item.sentAmount)}, mas o rateio agora diz{" "}
          {formatCurrency(item.businessAmount)}. Sincronizar atualiza o valor lá — nada é lançado
          duas vezes.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        {item.state === "NAO_ENVIADA" && (
          <Button size="sm" onClick={onEnviar}>
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Enviar para o financeiro
          </Button>
        )}
        {item.state === "DESATUALIZADA" && (
          <Button
            size="sm"
            onClick={() => sync.mutate(item.transactionId)}
            disabled={sync.isPending}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Sincronizar valor
          </Button>
        )}
        {item.state !== "NAO_ENVIADA" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => revert.mutate(item.transactionId)}
            disabled={revert.isPending}
          >
            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
            Desfazer envio
          </Button>
        )}
      </div>
    </div>
  );
}

function EnviarDialog({ item, onClose }: { item: VaultBridgeItem; onClose: () => void }) {
  // Prefill com a linha do extrato, mas editável: é um ponto de partida, não o
  // que vai automaticamente. Quem manda decide o que a empresa vai ler.
  const [description, setDescription] = useState(item.originalDescription);
  const [category, setCategory] = useState("OTHER");
  const [costSubscriptionId, setCostSubscriptionId] = useState("");
  const [notes, setNotes] = useState("");
  const plans = useVaultBridgePlans();
  const push = usePushToBusiness();

  const enviar = () => {
    push.mutate(
      {
        transactionId: item.transactionId,
        description: description.trim(),
        category,
        costSubscriptionId: costSubscriptionId || null,
        companyId: null,
        notes: notes.trim() || null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar {formatCurrency(item.businessAmount)} para o financeiro</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="envio-desc">Como isso aparece no financeiro</Label>
            <Input
              id="envio-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Este texto é o que a empresa vai ler. Vale reescrever a linha do banco para algo que
              faça sentido no fechamento do mês.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="envio-cat">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="envio-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="envio-plano">Realiza qual plano</Label>
              <Select
                value={costSubscriptionId || "nenhum"}
                onValueChange={(v) => setCostSubscriptionId(v === "nenhum" ? "" : v)}
              >
                <SelectTrigger id="envio-plano">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {(plans.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="envio-obs">Observação</Label>
            <Textarea
              id="envio-obs"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Vai só a parte da MilWeb ({formatCurrency(item.businessAmount)}) — não os{" "}
            {formatCurrency(item.amountBrl)} da compra. A conta, o cartão e as outras divisões ficam
            aqui.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={enviar} disabled={!description.trim() || push.isPending}>
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
