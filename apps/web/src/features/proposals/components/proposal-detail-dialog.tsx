"use client";

import { Eye, FileSignature } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useProposal } from "@/features/proposals/hooks";
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_VARIANT,
} from "@/features/proposals/proposal-labels";
import { PublicLinkCard } from "@/features/proposals/public-link-card";
import { formatCurrency, formatDate } from "@/utils/format";
import type { Proposal } from "@/types/api";

/** Detalhe da proposta em dialog (a listagem de propostas não tem rota
 * própria) -- link público, rastreio de abertura/decisão e, quando aceita,
 * o contrato herdado gerado a partir dela. A busca do detalhe só dispara
 * com o dialog aberto (contractId não vem na listagem, só no GET por id). */
export function ProposalDetailDialog({ proposal }: { proposal: Proposal }) {
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading } = useProposal(open ? proposal.id : null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
          <Eye className="h-4 w-4" />
          <span className="sr-only">Ver detalhes</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{proposal.title}</DialogTitle>
        </DialogHeader>

        {isLoading || !detail ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-sm">
              <Badge variant={PROPOSAL_STATUS_VARIANT[detail.status]}>
                {PROPOSAL_STATUS_LABELS[detail.status]}
              </Badge>
              <span className="font-medium">{formatCurrency(detail.value, detail.currency)}</span>
            </div>

            {detail.validUntil && (
              <p className="text-sm text-muted-foreground">
                Válida até {formatDate(detail.validUntil)}
              </p>
            )}

            <PublicLinkCard proposal={detail} />

            {detail.status === "ACCEPTED" && detail.contractId && (
              <Button asChild variant="outline">
                <Link href={`/contracts/${detail.contractId}`}>
                  <FileSignature /> Ver contrato
                </Link>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
