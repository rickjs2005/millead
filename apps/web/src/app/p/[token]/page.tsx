"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PublicProposalError, proposalsPublicService } from "@/services/proposals-public";
import type { PublicProposalStatus } from "@/types/api";
import { formatCurrency } from "@/utils/format";

const WHATSAPP_URL = "https://wa.me/553399877375";

// `timeZone: "UTC"` é obrigatório aqui: `validUntil` chega como data (meia-noite
// UTC) e sem fixar o fuso, toLocaleDateString converte pro fuso local do
// navegador -- no Brasil (UTC-3) isso mostra o dia ANTERIOR. Mesmo padrão de
// features/finance/components/credit-usage-section.tsx:60.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function CenteredState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {icon}
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const query = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => proposalsPublicService.get(token),
    retry: false,
  });

  const [localStatus, setLocalStatus] = useState<PublicProposalStatus | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  async function handleAccept() {
    setAccepting(true);
    try {
      const result = await proposalsPublicService.accept(token);
      setLocalStatus(result.status);
      setAcceptOpen(false);
    } catch (err) {
      if (err instanceof PublicProposalError && err.code === "GONE") {
        setLocalStatus("EXPIRED");
        setAcceptOpen(false);
      } else if (err instanceof PublicProposalError && err.code === "CONFLICT") {
        toast.error("Esta proposta já foi respondida.");
        setAcceptOpen(false);
        void query.refetch();
      } else {
        toast.error(
          err instanceof PublicProposalError
            ? err.message
            : "Não foi possível registrar o aceite. Tente novamente.",
        );
      }
    } finally {
      setAccepting(false);
    }
  }

  async function handleReject() {
    setRejecting(true);
    try {
      const result = await proposalsPublicService.reject(token, reason.trim() || undefined);
      setLocalStatus(result.status);
      setRejectOpen(false);
    } catch (err) {
      if (err instanceof PublicProposalError && err.code === "GONE") {
        setLocalStatus("EXPIRED");
        setRejectOpen(false);
      } else if (err instanceof PublicProposalError && err.code === "CONFLICT") {
        toast.error("Esta proposta já foi respondida.");
        setRejectOpen(false);
        void query.refetch();
      } else {
        toast.error(
          err instanceof PublicProposalError
            ? err.message
            : "Não foi possível registrar a recusa. Tente novamente.",
        );
      }
    } finally {
      setRejecting(false);
    }
  }

  if (query.isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
          <div className="flex flex-col items-center gap-2">
            <Logo />
          </div>
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    const isNotFound =
      query.error instanceof PublicProposalError && query.error.code === "NOT_FOUND";

    if (isNotFound) {
      return (
        <CenteredState
          icon={<CloudOff className="h-10 w-10 text-muted-foreground" />}
          title="Link indisponível"
          description={
            query.error instanceof PublicProposalError
              ? query.error.message
              : "Este link não é válido."
          }
        />
      );
    }

    return (
      <CenteredState
        icon={<AlertTriangle className="h-10 w-10 text-muted-foreground" />}
        title="Não foi possível carregar"
        description="Verifique sua conexão e tente de novo."
      >
        <Button className="h-11 px-6" onClick={() => query.refetch()}>
          <RefreshCw className="h-4 w-4" /> Tentar de novo
        </Button>
      </CenteredState>
    );
  }

  const proposal = query.data;
  const status = localStatus ?? proposal.status;

  if (status === "EXPIRED") {
    return (
      <CenteredState
        icon={<AlertTriangle className="h-10 w-10 text-muted-foreground" />}
        title="Esta proposta expirou"
        description="Fale com a gente pra atualizar os valores."
      >
        <Button asChild className="h-11 px-6">
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            Falar no WhatsApp
          </a>
        </Button>
      </CenteredState>
    );
  }

  if (status === "ACCEPTED") {
    return (
      <CenteredState
        icon={<CheckCircle2 className="h-14 w-14 text-success" />}
        title="Proposta aceita!"
        description="Em breve você recebe o contrato."
      />
    );
  }

  if (status === "REJECTED") {
    return (
      <CenteredState
        icon={<XCircle className="h-10 w-10 text-muted-foreground" />}
        title="Você recusou esta proposta"
        description="Mudou de ideia? Fale com a gente."
      />
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="text-2xl font-semibold tracking-tight">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">{proposal.organizationName}</p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Valor</span>
              <span className="text-2xl font-semibold tracking-tight">
                {formatCurrency(proposal.value, proposal.currency)}
              </span>
              {proposal.validUntil && (
                <span className="text-xs text-muted-foreground">
                  Válida até {formatDate(proposal.validUntil)}
                </span>
              )}
            </div>

            {proposal.scopeItems.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Escopo</span>
                <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                  {proposal.scopeItems.map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {proposal.pdfUrl && (
              <div className="flex flex-col gap-2">
                <iframe
                  src={proposal.pdfUrl}
                  className="h-[70vh] w-full rounded-lg border"
                  title="Proposta em PDF"
                />
                <a
                  href={proposal.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Abrir PDF em nova aba
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* h-11 (44px) nos botões públicos -- ver comentário equivalente em
            /b/[token]/page.tsx (o Button padrão é h-9, curto pro toque mobile). */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" className="h-11 px-6" onClick={() => setRejectOpen(true)}>
            Recusar
          </Button>
          <Button className="h-11 px-6" onClick={() => setAcceptOpen(true)}>
            Aceitar proposta
          </Button>
        </div>
      </div>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar aceite?</DialogTitle>
            <DialogDescription>
              Ao confirmar, você aceita os termos e o valor desta proposta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setAcceptOpen(false)}
              disabled={accepting}
            >
              Cancelar
            </Button>
            <Button className="h-11" onClick={handleAccept} disabled={accepting}>
              {accepting ? "Confirmando…" : "Confirmar aceite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar proposta</DialogTitle>
            <DialogDescription>
              Se quiser, conte o motivo — isso nos ajuda a melhorar (opcional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="min-h-24"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="h-11"
              onClick={handleReject}
              disabled={rejecting}
            >
              {rejecting ? "Enviando…" : "Confirmar recusa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
