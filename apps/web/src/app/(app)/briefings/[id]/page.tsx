"use client";

import {
  Archive,
  ArrowLeft,
  ClipboardList,
  Copy,
  Download,
  FileDown,
  MessageCircle,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BriefingAnswersView } from "@/features/briefings/components/briefing-answers-view";
import {
  BRIEFING_STATUS_LABELS,
  BRIEFING_STATUS_VARIANT,
  BRIEFING_TEMPLATE_KIND_LABELS,
} from "@/features/briefings/briefing-labels";
import {
  useArchiveBriefing,
  useBriefing,
  useDuplicateBriefing,
  useResendBriefing,
} from "@/features/briefings/hooks";
import { formatDateTime } from "@/utils/format";
import { publicAppUrl } from "@/lib/public-url";

export default function BriefingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: briefing, isLoading } = useBriefing(id);
  const archiveBriefing = useArchiveBriefing();
  const duplicateBriefing = useDuplicateBriefing();
  const resendBriefing = useResendBriefing();
  const { confirm, dialog } = useConfirmDialog();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!briefing) {
    return <EmptyState icon={ClipboardList} title="Briefing não encontrado" />;
  }

  const publicUrl = briefing.link ? `${publicAppUrl()}/b/${briefing.link.token}` : null;

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      <div className="flex flex-col gap-3">
        <Link
          href="/briefings"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Briefings
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {briefing.contactName ?? "Sem nome ainda"}
            </h1>
            <Badge variant={BRIEFING_STATUS_VARIANT[briefing.status]}>
              {BRIEFING_STATUS_LABELS[briefing.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {publicUrl && briefing.status !== "ARCHIVED" && (
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success("Link copiado.");
                }}
              >
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
            )}
            {briefing.pdfUrl && (
              <Button variant="outline" onClick={() => window.open(briefing.pdfUrl!, "_blank")}>
                <Download className="h-4 w-4" /> PDF
              </Button>
            )}
            {briefing.status === "COMPLETED" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => resendBriefing.mutate({ id: briefing.id, channel: "email" })}
                >
                  <Send className="h-4 w-4" /> Reenviar e-mail
                </Button>
                {briefing.contactPhone && (
                  <Button
                    variant="outline"
                    onClick={() => resendBriefing.mutate({ id: briefing.id, channel: "whatsapp" })}
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                )}
              </>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                const copy = await duplicateBriefing.mutateAsync(briefing.id);
                navigator.clipboard.writeText(`${publicAppUrl()}/b/${copy.link.token}`);
                toast.success("Briefing duplicado — novo link copiado.");
              }}
            >
              <Copy className="h-4 w-4" /> Duplicar
            </Button>
            {briefing.status !== "ARCHIVED" && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  confirm({
                    title: "Arquivar briefing?",
                    description: "O link público deixa de funcionar. Essa ação não pode ser desfeita.",
                    confirmLabel: "Arquivar",
                    onConfirm: () => archiveBriefing.mutate(briefing.id),
                  })
                }
              >
                <Archive className="h-4 w-4" /> Arquivar
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>{BRIEFING_TEMPLATE_KIND_LABELS[briefing.template.kind]}</span>
          <span>{briefing.contactEmail ?? "—"}</span>
          <span>{briefing.contactPhone ?? "—"}</span>
          <span>Criado em {formatDateTime(briefing.createdAt)}</span>
          {briefing.completedAt && <span>Concluído em {formatDateTime(briefing.completedAt)}</span>}
        </div>
        <div className="flex max-w-xs items-center gap-2">
          <Progress value={briefing.progressPercent} className="flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {briefing.progressPercent}%
          </span>
        </div>
      </div>

      <Tabs defaultValue="respostas">
        <TabsList>
          <TabsTrigger value="respostas">Respostas</TabsTrigger>
          <TabsTrigger value="arquivos">Arquivos ({briefing.files.length})</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="respostas">
          <BriefingAnswersView sections={briefing.template.sections} answers={briefing.answers} />
        </TabsContent>

        <TabsContent value="arquivos">
          {briefing.files.length === 0 ? (
            <EmptyState icon={FileDown} title="Nenhum arquivo enviado" className="py-16" />
          ) : (
            <div className="flex flex-col gap-2">
              {briefing.files.map((file) => (
                <a
                  key={file.id}
                  href={file.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-accent"
                >
                  <span className="truncate">{file.originalName}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </span>
                </a>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pdf">
          {briefing.pdfUrl ? (
            <Button onClick={() => window.open(briefing.pdfUrl!, "_blank")}>
              <Download className="h-4 w-4" /> Abrir PDF
            </Button>
          ) : (
            <EmptyState
              icon={FileDown}
              title="PDF ainda não gerado"
              description="É gerado automaticamente quando o cliente conclui o formulário."
              className="py-16"
            />
          )}
        </TabsContent>

        <TabsContent value="historico">
          <div className="flex flex-col gap-2">
            {briefing.history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <span>{entry.tipo}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
