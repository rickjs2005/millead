"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Proposal } from "@/types/api";

/** viewedAt/decidedAt são instantes (não date-only) -- formata sempre no
 * fuso de São Paulo, independente do fuso do navegador de quem está olhando. */
function formatSaoPaulo(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

/** Card do link público de aceite (`/p/:token`) + rastreio de abertura e
 * decisão do cliente. Usado no detalhe da proposta (Task 7). O link é o
 * próprio deploy do web (não precisa de NEXT_PUBLIC_WEB_URL): origin resolvido
 * só no cliente (useEffect) pra não quebrar o SSR nem gerar mismatch de
 * hidratação com `window`. */
export function PublicLinkCard({ proposal }: { proposal: Proposal }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!proposal.publicToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Link público</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O link é gerado quando a proposta é enviada.
          </p>
        </CardContent>
      </Card>
    );
  }

  const url = origin ? `${origin}/p/${proposal.publicToken}` : "";
  const viewedAt = formatSaoPaulo(proposal.viewedAt);
  const decidedAt = formatSaoPaulo(proposal.decidedAt);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Link público</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">
            {url || "…"}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!url}
            onClick={copyLink}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar
          </Button>
        </div>

        {viewedAt && (
          <p className="text-muted-foreground">Aberta pelo cliente em {viewedAt}</p>
        )}

        {proposal.status === "ACCEPTED" && decidedAt && (
          <p className="font-medium text-success">Aceita em {decidedAt}</p>
        )}

        {proposal.status === "REJECTED" && decidedAt && (
          <div className="flex flex-col gap-1">
            <p className="font-medium text-destructive">Recusada em {decidedAt}</p>
            {proposal.rejectReason && (
              <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                {proposal.rejectReason}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
