"use client";

import { CreditCard, Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  useCreateVaultCard,
  usePayVaultStatement,
  useUpdateVaultCard,
  useVaultAccounts,
  useVaultCards,
  useVaultStatements,
} from "@/features/vault/finance-hooks";
import { formatVaultDate, STATEMENT_STATUS_LABELS, todayInput } from "@/features/vault/format";
import { formatCurrency } from "@/utils/format";

export default function CofreCartoesPage() {
  const cards = useVaultCards();
  const statements = useVaultStatements();
  const update = useUpdateVaultCard();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NovoCartaoDialog />
      </div>

      {cards.isPending && <Skeleton className="h-40 w-full" />}

      {!cards.isPending && (cards.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão cadastrado"
          description="Cadastre o cartão com o dia de fechamento e vencimento — é o que decide em qual fatura cada compra cai."
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(cards.data ?? []).map((card) => {
          const doCartao = (statements.data ?? []).filter((s) => s.cardId === card.id);
          return (
            <Card key={card.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{card.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {card.institution ?? "—"}
                    {card.last4 && ` · final ${card.last4}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fecha dia {card.closingDay} · vence dia {card.dueDay}
                  </p>
                </div>
                <Switch
                  checked={card.isActive}
                  aria-label={`Ativar ${card.name}`}
                  onCheckedChange={(isActive) => update.mutate({ id: card.id, isActive })}
                />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {doCartao.length === 0 && (
                  <p className="text-muted-foreground">
                    Nenhuma fatura ainda — elas nascem quando a primeira compra é importada.
                  </p>
                )}
                {doCartao.slice(0, 4).map((statement) => {
                  const emAberto = Number(statement.totalAmount) - Number(statement.paidAmount);
                  return (
                    <div
                      key={statement.id}
                      className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <div className="font-medium">
                          {formatVaultDate(statement.referenceMonth)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          vence {formatVaultDate(statement.dueDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div>{formatCurrency(statement.totalAmount)}</div>
                          <Badge
                            variant={statement.status === "OVERDUE" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {STATEMENT_STATUS_LABELS[statement.status]}
                          </Badge>
                        </div>
                        {emAberto > 0 && (
                          <PagarFaturaDialog
                            statementId={statement.id}
                            valorEmAberto={emAberto.toFixed(2)}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Validade e código de segurança nunca são pedidos nem guardados. O pagamento da fatura entra
        como transferência — a despesa foi a compra, não o pagamento.
      </p>
    </div>
  );
}

function NovoCartaoDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateVaultCard();
  const accounts = useVaultAccounts();

  const [form, setForm] = useState({
    name: "",
    institution: "",
    last4: "",
    limitAmount: "",
    closingDay: "10",
    dueDay: "17",
    paymentAccountId: "",
  });

  async function submit() {
    await create.mutateAsync({
      name: form.name.trim(),
      institution: form.institution.trim() || null,
      last4: form.last4.trim() || null,
      limitAmount: form.limitAmount.trim() || null,
      closingDay: Number(form.closingDay),
      dueDay: Number(form.dueDay),
      paymentAccountId: form.paymentAccountId || null,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Novo cartão
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cartão</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cartao-nome">Nome</Label>
            <Input
              id="cartao-nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nubank"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cartao-banco">Instituição</Label>
              <Input
                id="cartao-banco"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartao-last4">4 últimos dígitos</Label>
              <Input
                id="cartao-last4"
                inputMode="numeric"
                maxLength={4}
                value={form.last4}
                onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cartao-fecha">Fecha dia</Label>
              <Input
                id="cartao-fecha"
                inputMode="numeric"
                value={form.closingDay}
                onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartao-vence">Vence dia</Label>
              <Input
                id="cartao-vence"
                inputMode="numeric"
                value={form.dueDay}
                onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cartao-limite">Limite</Label>
              <Input
                id="cartao-limite"
                inputMode="decimal"
                value={form.limitAmount}
                onChange={(e) => setForm({ ...form, limitAmount: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cartao-conta">Conta que paga a fatura</Label>
            <Select
              value={form.paymentAccountId}
              onValueChange={(paymentAccountId) => setForm({ ...form, paymentAccountId })}
            >
              <SelectTrigger id="cartao-conta">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            O dia de fechamento decide em qual fatura cada compra cai — dia 31 vira o último dia nos
            meses curtos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? "Criando…" : "Criar cartão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PagarFaturaDialog({
  statementId,
  valorEmAberto,
}: {
  statementId: string;
  valorEmAberto: string;
}) {
  const [open, setOpen] = useState(false);
  const pay = usePayVaultStatement();
  const accounts = useVaultAccounts();
  const [amount, setAmount] = useState(valorEmAberto);
  const [date, setDate] = useState(todayInput());
  const [accountId, setAccountId] = useState("");

  async function submit() {
    await pay.mutateAsync({ id: statementId, amount, date, accountId: accountId || null });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Pagar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pagamento da fatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pag-valor">Valor</Label>
              <Input
                id="pag-valor"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pag-data">Data</Label>
              <Input
                id="pag-data"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pag-conta">Conta de onde saiu</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="pag-conta">
                <SelectValue placeholder="Não registrar a saída agora" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Deixe em branco se o extrato dessa conta ainda vai ser importado — senão a saída
              entraria duas vezes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pay.isPending}>
            {pay.isPending ? "Salvando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
