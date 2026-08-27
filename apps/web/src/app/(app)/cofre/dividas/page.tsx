"use client";

import { HandCoins, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useAddDebtPayment,
  useCreateVaultDebt,
  useDeleteDebtPayment,
  useDeleteVaultDebt,
  useUpdateVaultDebt,
  useVaultContacts,
  useVaultDebtSummary,
  useVaultDebts,
} from "@/features/vault/debt-hooks";
import { useVaultTransactions } from "@/features/vault/finance-hooks";
import {
  DEBT_DIRECTION_LABELS,
  DEBT_STATUS_LABELS,
  formatVaultDate,
  todayInput,
} from "@/features/vault/format";
import { formatCurrency } from "@/utils/format";
import type { VaultDebt, VaultDebtDirection } from "@/types/api";

/**
 * Dívidas: quem me deve e para quem eu devo.
 *
 * A tela padrão mostra só o que está **em aberto**. Quitadas e canceladas
 * ficam atrás de um clique porque a pergunta que traz alguém aqui é "o que
 * ainda falta resolver" — misturar tudo transformaria a lista num extrato.
 */
export default function CofreDividasPage() {
  const [direcao, setDirecao] = useState<VaultDebtDirection | "TODAS">("TODAS");
  const [incluirResolvidas, setIncluirResolvidas] = useState(false);

  const filtros = {
    ...(direcao === "TODAS" ? {} : { direction: direcao }),
    includeSettled: incluirResolvidas,
    includeCanceled: incluirResolvidas,
  };
  const debts = useVaultDebts(filtros);
  const summary = useVaultDebtSummary();
  const contacts = useVaultContacts();

  const semPessoas = !contacts.isPending && (contacts.data?.length ?? 0) === 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <ResumoCard
          rotulo="A receber"
          valor={summary.data?.aReceber}
          atrasadas={summary.data?.atrasadasReceber}
          carregando={summary.isPending}
        />
        <ResumoCard
          rotulo="A pagar"
          valor={summary.data?.aPagar}
          atrasadas={summary.data?.atrasadasPagar}
          carregando={summary.isPending}
        />
        <div className="flex items-center justify-end sm:col-span-1">
          {!semPessoas && <NovaDividaDialog />}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={direcao} onValueChange={(v) => setDirecao(v as typeof direcao)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as direções</SelectItem>
            <SelectItem value="THEY_OWE_ME">A receber</SelectItem>
            <SelectItem value="I_OWE_THEM">A pagar</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => setIncluirResolvidas((v) => !v)}>
          {incluirResolvidas ? "Só as em aberto" : "Mostrar quitadas e canceladas"}
        </Button>
      </div>

      {semPessoas && (
        <EmptyState
          icon={HandCoins}
          title="Cadastre uma pessoa primeiro"
          description="Toda dívida é de alguém — comece cadastrando quem te deve ou para quem você deve."
          action={
            <Button asChild size="sm">
              <Link href="/cofre/pessoas">Ir para pessoas</Link>
            </Button>
          }
        />
      )}

      {debts.isPending && <Skeleton className="h-40 w-full" />}

      {!debts.isPending && !semPessoas && (debts.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={HandCoins}
          title={incluirResolvidas ? "Nenhuma dívida registrada" : "Nada em aberto"}
          description={
            incluirResolvidas
              ? "Registre um empréstimo, uma conta dividida ou uma compra feita para outra pessoa."
              : "Todas as dívidas registradas já foram resolvidas."
          }
        />
      )}

      <div className="space-y-3">
        {(debts.data ?? []).map((debt) => (
          <DividaCard key={debt.id} debt={debt} />
        ))}
      </div>
    </div>
  );
}

function ResumoCard({
  rotulo,
  valor,
  atrasadas,
  carregando,
}: {
  rotulo: string;
  valor: string | undefined;
  atrasadas: number | undefined;
  carregando: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      {carregando ? (
        <Skeleton className="mt-1 h-7 w-24" />
      ) : (
        <div className="text-xl font-semibold tabular-nums">{formatCurrency(valor ?? "0")}</div>
      )}
      {(atrasadas ?? 0) > 0 && (
        <Badge variant="destructive" className="mt-1 text-[10px]">
          {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}
        </Badge>
      )}
    </div>
  );
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "secondary",
  PARTIAL: "default",
  PAID: "outline",
  OVERDUE: "destructive",
  CANCELED: "outline",
};

function DividaCard({ debt }: { debt: VaultDebt }) {
  const update = useUpdateVaultDebt();
  const remove = useDeleteVaultDebt();
  const removePayment = useDeleteDebtPayment();

  const pago = Number(debt.paidAmount);
  const total = Number(debt.originalAmount);
  const progresso = total > 0 ? Math.min(100, Math.round((pago / total) * 100)) : 0;
  const resolvida = debt.status === "PAID" || debt.status === "CANCELED";

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{debt.description}</span>
            <Badge variant={STATUS_VARIANT[debt.status] ?? "secondary"} className="text-[10px]">
              {DEBT_STATUS_LABELS[debt.status] ?? debt.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {DEBT_DIRECTION_LABELS[debt.direction]}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {debt.contactName}
            {debt.dueDate && ` · vence em ${formatVaultDate(debt.dueDate)}`}
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{formatCurrency(debt.balance)}</div>
          <div className="text-xs text-muted-foreground">
            de {formatCurrency(debt.originalAmount)}
            {pago > 0 && ` · ${formatCurrency(debt.paidAmount)} baixado`}
          </div>
        </div>
      </div>

      {pago > 0 && !resolvida && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${progresso}%` }} />
        </div>
      )}

      {Number(debt.overpaid) > 0 && (
        <p className="text-xs text-destructive">
          Devolvido {formatCurrency(debt.overpaid)} a mais que o valor da dívida — ajuste as baixas
          ou o valor.
        </p>
      )}

      {debt.payments.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {debt.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {formatVaultDate(p.paidAt)} · {formatCurrency(p.amount)}
                {p.transactionId && " · vinculada a uma movimentação"}
                {p.note && ` · ${p.note}`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover baixa"
                onClick={() => removePayment.mutate({ debtId: debt.id, paymentId: p.id })}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {debt.notes && <p className="text-xs text-muted-foreground">{debt.notes}</p>}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        {debt.status !== "PAID" && debt.status !== "CANCELED" && <BaixaDialog debt={debt} />}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => update.mutate({ id: debt.id, canceled: debt.status !== "CANCELED" })}
        >
          {debt.status === "CANCELED" ? "Reabrir" : "Cancelar"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => remove.mutate(debt.id)}>
          Apagar
        </Button>
      </div>
    </div>
  );
}

/**
 * Registrar uma baixa.
 *
 * O vínculo com a movimentação é opcional, mas é o que faz a diferença: sem
 * ele a dívida baixa e o Pix continua contando como renda. Com ele, o mesmo
 * dinheiro para de ser contado duas vezes.
 */
function BaixaDialog({ debt }: { debt: VaultDebt }) {
  const [aberto, setAberto] = useState(false);
  const [amount, setAmount] = useState(debt.balance);
  const [paidAt, setPaidAt] = useState(todayInput());
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const add = useAddDebtPayment();

  // Só as movimentações que PODEM ser esta baixa: direção certa, sem
  // transferência e ainda sem vínculo. Oferecer as outras só produziria erro
  // depois de escolher.
  const candidatas = useVaultTransactions({
    direction: debt.direction === "THEY_OWE_ME" ? "IN" : "OUT",
    includeTransfers: false,
    pageSize: 50,
  });
  const disponiveis = (candidatas.data?.items ?? []).filter((t) => t.settlesDebtId === null);

  const salvar = () => {
    add.mutate(
      {
        debtId: debt.id,
        amount,
        paidAt,
        transactionId: transactionId || null,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setAberto(false);
          setTransactionId("");
          setNote("");
        },
      },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Registrar baixa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baixa em &ldquo;{debt.description}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="baixa-valor">Valor</Label>
              <Input
                id="baixa-valor"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                Saldo devedor: {formatCurrency(debt.balance)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baixa-data">Data</Label>
              <Input
                id="baixa-data"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baixa-mov">Movimentação (opcional)</Label>
            <Select
              value={transactionId || "nenhuma"}
              onValueChange={(v) => setTransactionId(v === "nenhuma" ? "" : v)}
            >
              <SelectTrigger id="baixa-mov">
                <SelectValue placeholder="Sem movimentação vinculada" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem movimentação (recebi em dinheiro)</SelectItem>
                {disponiveis.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {formatVaultDate(t.transactionDate)} · {formatCurrency(t.amountBrl)} ·{" "}
                    {t.originalDescription}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Vinculando, essa movimentação deixa de contar como{" "}
              {debt.direction === "THEY_OWE_ME" ? "receita" : "despesa"} — o valor já foi contado
              quando a dívida nasceu.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="baixa-obs">Observação</Label>
            <Input id="baixa-obs" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={!amount || add.isPending}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaDividaDialog() {
  const [aberto, setAberto] = useState(false);
  const [contactId, setContactId] = useState("");
  const [direction, setDirection] = useState<VaultDebtDirection>("THEY_OWE_ME");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [originTransactionId, setOriginTransactionId] = useState("");
  const [markReimbursable, setMarkReimbursable] = useState(true);
  const [notes, setNotes] = useState("");

  const contacts = useVaultContacts();
  const create = useCreateVaultDebt();

  // A origem só faz sentido para "alguém me deve": é a compra que você fez e
  // vai receber de volta. Por isso a lista é sempre de saídas.
  const compras = useVaultTransactions({
    direction: "OUT",
    includeTransfers: false,
    pageSize: 50,
  });

  const podeMarcar = direction === "THEY_OWE_ME" && originTransactionId !== "";

  const salvar = () => {
    create.mutate(
      {
        contactId,
        direction,
        description: description.trim(),
        amount,
        currency: "BRL",
        dueDate: dueDate || null,
        originTransactionId: originTransactionId || null,
        notes: notes.trim() || null,
        markOriginReimbursable: podeMarcar && markReimbursable,
      },
      {
        onSuccess: () => {
          setAberto(false);
          setDescription("");
          setAmount("");
          setDueDate("");
          setOriginTransactionId("");
          setNotes("");
        },
      },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nova dívida
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova dívida</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="divida-pessoa">Pessoa</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger id="divida-pessoa">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {(contacts.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="divida-direcao">Direção</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as VaultDebtDirection)}
              >
                <SelectTrigger id="divida-direcao">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="THEY_OWE_ME">Essa pessoa me deve</SelectItem>
                  <SelectItem value="I_OWE_THEM">Eu devo para ela</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="divida-desc">Descrição</Label>
            <Input
              id="divida-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Parte do Bruno no jantar"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="divida-valor">Valor</Label>
              <Input
                id="divida-valor"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="100.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="divida-venc">Vencimento (opcional)</Label>
              <Input
                id="divida-venc"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {direction === "THEY_OWE_ME" && (
            <div className="space-y-1.5 rounded-md border border-border p-3">
              <Label htmlFor="divida-origem">Compra que gerou a dívida (opcional)</Label>
              <Select
                value={originTransactionId || "nenhuma"}
                onValueChange={(v) => setOriginTransactionId(v === "nenhuma" ? "" : v)}
              >
                <SelectTrigger id="divida-origem">
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  {(compras.data?.items ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {formatVaultDate(t.transactionDate)} · {formatCurrency(t.amountBrl)} ·{" "}
                      {t.originalDescription}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {podeMarcar && (
                <label className="mt-2 flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={markReimbursable}
                    onCheckedChange={(v) => setMarkReimbursable(v === true)}
                  />
                  <span className="text-muted-foreground">
                    Marcar essa parte como reembolsável na compra — assim ela sai do seu consumo
                    pessoal no mesmo instante em que vira valor a receber.
                  </span>
                </label>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="divida-notas">Observações</Label>
            <Textarea
              id="divida-notas"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={salvar}
            disabled={!contactId || !description.trim() || !amount || create.isPending}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
