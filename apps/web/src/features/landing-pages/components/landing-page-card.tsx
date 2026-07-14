"use client";

import {
  Copy,
  Eye,
  Globe,
  GlobeLock,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompany } from "@/features/companies/hooks";
import {
  useDeleteLandingPage,
  useLandingPage,
  usePublishLandingPage,
  useRegenerateLandingPage,
} from "@/features/landing-pages/hooks";
import {
  LANDING_PAGE_KIND_LABELS,
  LANDING_PAGE_STATUS_LABELS,
  LANDING_PAGE_STATUS_VARIANT,
} from "@/features/landing-pages/landing-page-labels";
import { publicLandingPageUrl } from "@/services/landing-pages";
import { formatDateTime } from "@/utils/format";
import type { LandingPage } from "@/types/api";

export function LandingPageCard({ page }: { page: LandingPage }) {
  const { data: company } = useCompany(page.companyId);
  const publish = usePublishLandingPage();
  const regenerate = useRegenerateLandingPage();
  const deletePage = useDeleteLandingPage();
  const { confirm, dialog } = useConfirmDialog();

  const [previewOpen, setPreviewOpen] = useState(false);
  // Só busca o HTML (pesado) quando o preview abre.
  const { data: detail, isLoading: detailLoading } = useLandingPage(
    previewOpen ? page.id : undefined,
  );

  const pending = page.status === "QUEUED" || page.status === "GENERATING";
  const publicUrl = publicLandingPageUrl(page.slug);

  function copyLink() {
    void navigator.clipboard.writeText(publicUrl);
    toast.success("Link público copiado.");
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{page.title}</p>
            <p className="text-xs text-muted-foreground">
              {company ? (
                <Link href={`/companies/${page.companyId}`} className="hover:underline">
                  {company.name}
                </Link>
              ) : (
                "…"
              )}{" "}
              · {LANDING_PAGE_KIND_LABELS[page.kind]} · {formatDateTime(page.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant={LANDING_PAGE_STATUS_VARIANT[page.status]} className="gap-1">
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              {LANDING_PAGE_STATUS_LABELS[page.status]}
            </Badge>
            {page.isPublished && (
              <Badge variant="success" className="gap-1">
                <Globe className="h-3 w-3" /> No ar
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={page.status !== "READY"}
                  onSelect={() => setPreviewOpen(true)}
                >
                  <Eye /> Visualizar
                </DropdownMenuItem>
                {page.isPublished ? (
                  <>
                    <DropdownMenuItem onSelect={copyLink}>
                      <Copy /> Copiar link público
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => publish.mutate({ id: page.id, published: false })}
                    >
                      <GlobeLock /> Despublicar
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    disabled={page.status !== "READY"}
                    onSelect={() => publish.mutate({ id: page.id, published: true })}
                  >
                    <Globe /> Publicar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  disabled={pending}
                  onSelect={() => regenerate.mutate({ id: page.id })}
                >
                  <RefreshCw /> Gerar novamente
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() =>
                    confirm({
                      title: "Excluir landing page",
                      description: `Excluir "${page.title}"? O link público (se houver) deixa de funcionar na hora.`,
                      confirmLabel: "Excluir",
                      onConfirm: async () => {
                        await deletePage.mutateAsync(page.id);
                      },
                    })
                  }
                >
                  <Trash2 /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {page.status === "FAILED" && (
          <p className="text-sm text-destructive">{page.errorMessage ?? "A geração falhou."}</p>
        )}

        {page.isPublished && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate font-mono text-primary hover:underline"
            >
              {publicUrl}
            </a>
            <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
              <Eye className="h-3 w-3" /> {page.views} visita{page.views === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </CardContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95dvw] sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{page.title}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex h-[70dvh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail?.html ? (
            <iframe
              srcDoc={detail.html}
              sandbox=""
              title={page.title}
              className="h-[70dvh] w-full rounded-lg border border-border bg-white"
            />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              O HTML ainda não está disponível.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {dialog}
    </Card>
  );
}
