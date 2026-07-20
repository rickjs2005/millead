"use client";

import {
  Archive,
  ClipboardList,
  Copy,
  Download,
  MessageCircle,
  MoreVertical,
  Search,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BRIEFING_STATUS_LABELS,
  BRIEFING_STATUS_VARIANT,
  BRIEFING_TEMPLATE_KIND_LABELS,
} from "@/features/briefings/briefing-labels";
import { CreateBriefingDialog } from "@/features/briefings/components/create-briefing-dialog";
import {
  useArchiveBriefing,
  useBriefingTemplates,
  useBriefings,
  useDuplicateBriefing,
  useResendBriefing,
} from "@/features/briefings/hooks";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate } from "@/utils/format";
import type { BriefingStatus } from "@/types/api";
import { publicAppUrl } from "@/lib/public-url";

export default function BriefingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BriefingStatus | "ALL">(
    (searchParams.get("status") as BriefingStatus | null) ?? "ALL",
  );
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const { confirm, dialog } = useConfirmDialog();

  const { data: templates } = useBriefingTemplates();
  const templateKindByKey = new Map((templates ?? []).map((t) => [t.id, t.kind]));

  const { data, isLoading, isError, refetch } = useBriefings({
    page,
    pageSize: 15,
    status: status === "ALL" ? undefined : status,
    search: debouncedSearch || undefined,
  });

  const archiveBriefing = useArchiveBriefing();
  const duplicateBriefing = useDuplicateBriefing();
  const resendBriefing = useResendBriefing();

  function setStatusAndSync(value: BriefingStatus | "ALL") {
    setStatus(value);
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") params.delete("status");
    else params.set("status", value);
    router.replace(`/briefings${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {dialog}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Briefings</h1>
          <p className="text-sm text-muted-foreground">
            Onboarding de cliente sem ida e volta por WhatsApp — link, formulário e PDF automáticos.
          </p>
        </div>
        <CreateBriefingDialog />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nome ou e-mail do cliente…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatusAndSync(v as BriefingStatus | "ALL")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(BRIEFING_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum briefing ainda"
          description="Crie o primeiro pelo botão acima e envie o link pro cliente preencher."
          className="py-20"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((briefing) => {
            const kind = briefing.templateKind ?? templateKindByKey.get(briefing.templateId);
            return (
              <div
                key={briefing.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
              >
                <Link href={`/briefings/${briefing.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {briefing.contactName ?? "Sem nome ainda"}
                    {kind && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        {BRIEFING_TEMPLATE_KIND_LABELS[kind]}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {briefing.contactEmail ?? "—"} · {formatDate(briefing.createdAt)}
                  </p>
                </Link>
                <div className="hidden w-32 flex-col gap-1 sm:flex">
                  <Progress value={briefing.progressPercent} />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {briefing.progressPercent}%
                  </span>
                </div>
                <Badge variant={BRIEFING_STATUS_VARIANT[briefing.status]}>
                  {BRIEFING_STATUS_LABELS[briefing.status]}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Ações">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/briefings/${briefing.id}`}>Visualizar</Link>
                    </DropdownMenuItem>
                    {briefing.pdfUrl && (
                      <DropdownMenuItem onSelect={() => window.open(briefing.pdfUrl!, "_blank")}>
                        <Download className="h-4 w-4" /> Baixar PDF
                      </DropdownMenuItem>
                    )}
                    {briefing.status === "COMPLETED" && (
                      <>
                        <DropdownMenuItem
                          onSelect={() =>
                            resendBriefing.mutate({ id: briefing.id, channel: "email" })
                          }
                        >
                          <Send className="h-4 w-4" /> Reenviar e-mail
                        </DropdownMenuItem>
                        {briefing.contactPhone && (
                          <DropdownMenuItem
                            onSelect={() =>
                              resendBriefing.mutate({ id: briefing.id, channel: "whatsapp" })
                            }
                          >
                            <MessageCircle className="h-4 w-4" /> Reenviar WhatsApp
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                    <DropdownMenuItem
                      onSelect={async () => {
                        const copy = await duplicateBriefing.mutateAsync(briefing.id);
                        navigator.clipboard.writeText(`${publicAppUrl()}/b/${copy.link.token}`);
                        toast.success("Briefing duplicado — novo link copiado.");
                      }}
                    >
                      <Copy className="h-4 w-4" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {briefing.status !== "ARCHIVED" && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() =>
                          confirm({
                            title: "Arquivar briefing?",
                            description:
                              "O link público deixa de funcionar. Essa ação não pode ser desfeita.",
                            confirmLabel: "Arquivar",
                            onConfirm: () => archiveBriefing.mutate(briefing.id),
                          })
                        }
                      >
                        <Archive className="h-4 w-4" /> Arquivar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
