"use client";

import { Bell, CreditCard, Landmark, Receipt, Repeat } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { describeAlert, formatVaultDate } from "@/features/vault/format";
import {
  useVaultAccounts,
  useVaultStatements,
  useVaultTransactions,
} from "@/features/vault/finance-hooks";
import { useVaultAlerts, useVaultSubscriptions } from "@/features/vault/subscription-hooks";
import { formatCurrency } from "@/utils/format";

/**
 * Visão geral do Cofre.
 *
 * Mostra o que **exige ação** primeiro (alertas, movimentações esperando
 * revisão, faturas em aberto) e só depois os números. Um painel que começa
 * por saldo é bonito e inútil: o saldo você já sabe; o que você não sabe é o
 * que está esperando por você.
 */
export default function CofreVisaoGeralPage() {
  const accounts = useVaultAccounts();
  const alerts = useVaultAlerts();
  const subscriptions = useVaultSubscriptions("ACTIVE");
  const statements = useVaultStatements();
  const pendentes = useVaultTransactions({
    status: "PENDING",
    pageSize: 1,
    includeTransfers: true,
  });

  const saldoInformado = (accounts.data ?? []).reduce(
    (total, account) => total + Number(account.reportedBalance ?? 0),
    0,
  );
  const faturasAbertas = (statements.data ?? []).filter((statement) => statement.status !== "PAID");
  const totalFaturas = faturasAbertas.reduce(
    (total, statement) => total + (Number(statement.totalAmount) - Number(statement.paidAmount)),
    0,
  );

  const carregando = accounts.isPending || alerts.isPending || statements.isPending;

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Bell}
          label="Alertas"
          value={carregando ? null : String(alerts.data?.length ?? 0)}
          hint="assinaturas pedindo atenção"
          href="/cofre/alertas"
          destaque={(alerts.data?.length ?? 0) > 0}
        />
        <StatCard
          icon={Receipt}
          label="A revisar"
          value={pendentes.isPending ? null : String(pendentes.data?.total ?? 0)}
          hint="movimentações sem categoria"
          href="/cofre/movimentacoes?status=PENDING"
          destaque={(pendentes.data?.total ?? 0) > 0}
        />
        <StatCard
          icon={Landmark}
          label="Saldo informado"
          value={carregando ? null : formatCurrency(saldoInformado)}
          hint="soma do que você informou nas contas"
          href="/cofre/contas"
        />
        <StatCard
          icon={CreditCard}
          label="Faturas em aberto"
          value={carregando ? null : formatCurrency(totalFaturas)}
          hint={`${faturasAbertas.length} ${faturasAbertas.length === 1 ? "fatura" : "faturas"}`}
          href="/cofre/cartoes"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Alertas</CardTitle>
            <Link href="/cofre/alertas" className="text-xs text-muted-foreground hover:underline">
              Ver todos
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {alerts.isPending && <Skeleton className="h-16 w-full" />}
            {!alerts.isPending && (alerts.data?.length ?? 0) === 0 && (
              <p className="text-muted-foreground">Nada pedindo atenção agora.</p>
            )}
            {(alerts.data ?? []).slice(0, 5).map((alert) => (
              <p key={alert.id} className="text-foreground">
                {describeAlert(alert.type, alert.payload)}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Próximas renovações</CardTitle>
            <Link
              href="/cofre/assinaturas"
              className="text-xs text-muted-foreground hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {subscriptions.isPending && <Skeleton className="h-16 w-full" />}
            {!subscriptions.isPending && (subscriptions.data?.length ?? 0) === 0 && (
              <p className="text-muted-foreground">
                Nenhuma assinatura cadastrada. Importe um extrato — cobranças que se repetem viram
                sugestão.
              </p>
            )}
            {(subscriptions.data ?? [])
              .filter((s) => s.nextRenewalAt)
              .sort((a, b) => (a.nextRenewalAt! < b.nextRenewalAt! ? -1 : 1))
              .slice(0, 5)
              .map((subscription) => (
                <div key={subscription.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    {subscription.name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatVaultDate(subscription.nextRenewalAt)} ·{" "}
                    {formatCurrency(subscription.expectedCents / 100)}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  destaque,
}: {
  icon: typeof Bell;
  label: string;
  value: string | null;
  hint: string;
  href: string;
  destaque?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-foreground/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
            {destaque && (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                ação
              </Badge>
            )}
          </div>
          {value === null ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-medium">{value}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
