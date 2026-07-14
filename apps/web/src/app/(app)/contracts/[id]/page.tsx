"use client";

import {
  ArrowLeft,
  Ban,
  Copy,
  Download,
  FileSignature,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CONTRACT_EVENT_LABELS,
  CONTRACT_PAYMENT_LABELS,
  CONTRACT_PENDING_STATUSES,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_VARIANT,
  CONTRACT_TYPE_LABELS,
} from "@/features/contracts/contract-labels";
import {
  useContract,
  useReprocessContract,
  useUpdateContractStatus,
} from "@/features/contracts/hooks";
import { contractsService } from "@/services/contracts";
import { formatCurrency, formatDateTime } from "@/utils/format";

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isLoading } = useContract(id);
  const updateStatus = useUpdateContractStatus();
  const reprocess = useReprocessContract();
  const { confirm, dialog } = useConfirmDialog();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!contract) {
    return <EmptyState icon={FileSignature} title="Contrato não encontrado" />;
  }

  const c = contract.contractorSnapshot;
  const pending = CONTRACT_PENDING_STATUSES.includes(contract.status);
  const entrada =
    (Number(contract.valorTotal) * Number(contract.percentualEntrada)) / 100;

  async function openPdf(versao: "original" | "assinado") {
    try {
      await contractsService.openPdf(contract!.id, versao);
    } catch {
      toast.error("PDF ainda não disponível.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/contracts"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Contratos
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{contract.numero}</h1>
            <Badge variant={CONTRACT_STATUS_VARIANT[contract.status]} className="gap-1">
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              {CONTRACT_STATUS_LABELS[contract.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {contract.hasPdfOriginal && (
              <Button variant="outline" size="sm" onClick={() => openPdf("original")}>
                <Download /> PDF
              </Button>
            )}
            {contract.hasPdfAssinado && (
              <Button variant="outline" size="sm" onClick={() => openPdf("assinado")}>
                <Download /> PDF assinado
              </Button>
            )}
            {contract.signatureUrl && contract.status === "AGUARDANDO_ASSINATURA" && (
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(contract.signatureUrl!);
                  toast.success("Link de assinatura copiado.");
                }}
              >
                <Copy /> Copiar link de assinatura
              </Button>
            )}
            {(contract.status === "RASCUNHO" || contract.status === "PDF_GERADO") && (
              <Button
                variant="outline"
                size="sm"
                disabled={reprocess.isPending}
                onClick={() => reprocess.mutate(contract.id)}
              >
                <RefreshCw /> Reprocessar
              </Button>
            )}
            {contract.status !== "ASSINADO" && contract.status !== "CANCELADO" && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() =>
                  confirm({
                    title: "Cancelar contrato",
                    description: `Cancelar o contrato ${contract.numero}? O link de assinatura deixa de valer.`,
                    confirmLabel: "Cancelar contrato",
                    cancelLabel: "Voltar",
                    onConfirm: async () => {
                      await updateStatus.mutateAsync({ id: contract.id, status: "CANCELADO" });
                    },
                  })
                }
              >
                <Ban /> Cancelar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Contratante</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <p className="font-medium">{c.nomeEmpresa ?? c.nome}</p>
              {c.nomeEmpresa && <p className="text-muted-foreground">Responsável: {c.nome}</p>}
              <p className="text-muted-foreground">
                {c.tipoPessoa === "PJ" ? "CNPJ" : "CPF"}: {c.documento}
              </p>
              <p className="text-muted-foreground">{c.email} · {c.telefone}</p>
              <p className="text-muted-foreground">{c.endereco}</p>
              <Link
                href={`/companies/${contract.companyId}`}
                className="mt-1 text-xs font-medium text-primary hover:underline"
              >
                Ver empresa no CRM
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projeto e financeiro</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                {CONTRACT_TYPE_LABELS[contract.tipo]}
              </p>
              <p className="whitespace-pre-wrap">{contract.descricaoProjeto}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3">
                <p>
                  <span className="text-muted-foreground">Valor total:</span>{" "}
                  <strong>{formatCurrency(contract.valorTotal)}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Pagamento:</span>{" "}
                  {CONTRACT_PAYMENT_LABELS[contract.formaPagamento]}
                </p>
                <p>
                  <span className="text-muted-foreground">
                    Entrada ({Number(contract.percentualEntrada)}%):
                  </span>{" "}
                  {formatCurrency(entrada)}
                </p>
                <p>
                  <span className="text-muted-foreground">Prazo:</span>{" "}
                  {contract.prazoEntregaDias} dias
                </p>
              </div>
              {contract.assinadoEm && (
                <p className="mt-1 text-sm text-success">
                  Assinado em {formatDateTime(contract.assinadoEm)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Signatários</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {contract.signers.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{s.nome}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{s.papel}</Badge>
                    {s.assinadoEm ? (
                      <Badge variant="success">Assinou</Badge>
                    ) : (
                      <Badge variant="secondary">Pendente</Badge>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {contract.events.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm">
                  <span>{CONTRACT_EVENT_LABELS[e.tipo] ?? e.tipo}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(e.createdAt)} · {e.origem}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      {dialog}
    </div>
  );
}
