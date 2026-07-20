"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, FileSignature, Mail, MessageCircle, Plug, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { settingsService } from "@/services/settings";
import type { IntegrationStatus, IntegrationStatusLevel } from "@/types/api";

const ICON_BY_KEY: Record<IntegrationStatus["key"], LucideIcon> = {
  email: Mail,
  whatsapp: MessageCircle,
  signature: FileSignature,
  ai: Bot,
};

const STATUS_STYLE: Record<
  IntegrationStatusLevel,
  { label: string; className: string; dot: string }
> = {
  connected: {
    label: "Conectado",
    className: "bg-emerald-500/10 text-emerald-500 ring-1 ring-inset ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  disabled: {
    label: "Desabilitado",
    className: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dot: "bg-muted-foreground",
  },
  not_configured: {
    label: "Não configurado",
    className: "bg-amber-500/10 text-amber-500 ring-1 ring-inset ring-amber-500/20",
    dot: "bg-amber-500",
  },
};

function StatusPill({ status }: { status: IntegrationStatusLevel }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        s.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

function IntegrationCard({ integration }: { integration: IntegrationStatus }) {
  const Icon = ICON_BY_KEY[integration.key] ?? Plug;
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{integration.name}</p>
            <StatusPill status={integration.status} />
          </div>
          <p className="text-sm text-muted-foreground">{integration.description}</p>
          {integration.detail && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">{integration.detail}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function IntegrationsSettingsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.settings.integrations(),
    queryFn: settingsService.getIntegrations,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Canais e serviços conectados ao MilLead. Hoje são geridos no nível da plataforma; conexão
          por organização chega numa próxima fase.
        </p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[74px] animate-pulse rounded-xl border border-border bg-muted/40"
            />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Plug className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as integrações.
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm font-medium text-primary hover:underline"
            >
              Tentar de novo
            </button>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="flex flex-col gap-3">
          {data.integrations.map((integration) => (
            <IntegrationCard key={integration.key} integration={integration} />
          ))}
        </div>
      )}
    </div>
  );
}
