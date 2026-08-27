"use client";

import { Landmark, Plus } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateVaultAccount,
  useUpdateVaultAccount,
  useVaultAccounts,
} from "@/features/vault/finance-hooks";
import { ACCOUNT_TYPE_LABELS, formatVaultDate, todayInput } from "@/features/vault/format";
import type { PersonalAccountType } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export default function CofreContasPage() {
  const [incluirInativas, setIncluirInativas] = useState(false);
  const accounts = useVaultAccounts(incluirInativas);
  const update = useUpdateVaultAccount();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch id="inativas" checked={incluirInativas} onCheckedChange={setIncluirInativas} />
          <Label htmlFor="inativas" className="text-sm font-normal text-muted-foreground">
            Mostrar inativas
          </Label>
        </div>
        <NovaContaDialog />
      </div>

      {accounts.isPending && <Skeleton className="h-40 w-full" />}

      {!accounts.isPending && (accounts.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas para importar extratos e acompanhar o saldo."
        />
      )}

      {(accounts.data?.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Saldo informado</TableHead>
                <TableHead className="text-right">Ativa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.data!.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="font-medium">{account.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {account.institution ?? "—"}
                      {/* Só os 4 últimos dígitos existem no sistema. */}
                      {account.last4 && ` · final ${account.last4}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatCurrency(account.reportedBalance, account.currency)}</div>
                    {account.reportedBalanceAt && (
                      <div className="text-xs text-muted-foreground">
                        em {formatVaultDate(account.reportedBalanceAt)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={account.isActive}
                      aria-label={`Ativar ${account.name}`}
                      onCheckedChange={(isActive) => update.mutate({ id: account.id, isActive })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Conta com movimentação não é apagada, é desativada — o histórico continua valendo nos
        relatórios. O número completo da conta nunca é guardado.
      </p>
    </div>
  );
}

function NovaContaDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateVaultAccount();

  const [form, setForm] = useState({
    name: "",
    institution: "",
    type: "CHECKING" as PersonalAccountType,
    last4: "",
    reportedBalance: "",
  });

  async function submit() {
    await create.mutateAsync({
      name: form.name.trim(),
      institution: form.institution.trim() || null,
      type: form.type,
      currency: "BRL",
      last4: form.last4.trim() || null,
      reportedBalance: form.reportedBalance.trim() || null,
      // Saldo sem data seria um número sem significado: "saldo de quando?".
      reportedBalanceAt: form.reportedBalance.trim() ? todayInput() : null,
    });
    setOpen(false);
    setForm({ name: "", institution: "", type: "CHECKING", last4: "", reportedBalance: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nova conta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="conta-nome">Nome</Label>
            <Input
              id="conta-nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Conta principal"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="conta-banco">Instituição</Label>
              <Input
                id="conta-banco"
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="Inter"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-tipo">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(type) => setForm({ ...form, type: type as PersonalAccountType })}
              >
                <SelectTrigger id="conta-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="conta-last4">4 últimos dígitos</Label>
              <Input
                id="conta-last4"
                inputMode="numeric"
                maxLength={4}
                value={form.last4}
                onChange={(e) => setForm({ ...form, last4: e.target.value.replace(/\D/g, "") })}
                placeholder="1234"
              />
              <p className="text-[11px] text-muted-foreground">
                Só para você distinguir duas contas do mesmo banco.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="conta-saldo">Saldo hoje</Label>
              <Input
                id="conta-saldo"
                inputMode="decimal"
                value={form.reportedBalance}
                onChange={(e) => setForm({ ...form, reportedBalance: e.target.value })}
                placeholder="1234.56"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? "Criando…" : "Criar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
