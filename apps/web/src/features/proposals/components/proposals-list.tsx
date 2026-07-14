"use client";

import { Handshake } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateProposal } from "@/features/proposals/hooks";
import {
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_VARIANT,
} from "@/features/proposals/proposal-labels";
import { formatCurrency, formatDate } from "@/utils/format";
import type { Proposal, ProposalStatus } from "@/types/api";

function ProposalRow({ proposal }: { proposal: Proposal }) {
  const updateProposal = useUpdateProposal(proposal.id);

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{proposal.title}</TableCell>
      <TableCell>{formatCurrency(proposal.value, proposal.currency)}</TableCell>
      <TableCell>
        <Select
          value={proposal.status}
          onValueChange={(status) => updateProposal.mutate({ status: status as ProposalStatus })}
        >
          <SelectTrigger className="h-7 w-36 border-none bg-transparent px-0 shadow-none [&>svg]:opacity-40">
            <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]}>
              {PROPOSAL_STATUS_LABELS[proposal.status]}
            </Badge>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROPOSAL_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(proposal.validUntil)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(proposal.sentAt)}</TableCell>
    </TableRow>
  );
}

export function ProposalsList({
  proposals,
  isLoading,
}: {
  proposals: Proposal[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={Handshake}
        title="Nenhuma proposta encontrada"
        className="border-none py-16"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Válida até</TableHead>
          <TableHead>Enviada em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((proposal) => (
          <ProposalRow key={proposal.id} proposal={proposal} />
        ))}
      </TableBody>
    </Table>
  );
}
