"use client";

import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateMeetingDialog } from "@/features/meetings/components/create-meeting-dialog";
import { MeetingsList } from "@/features/meetings/components/meetings-list";
import { useMeetings } from "@/features/meetings/hooks";
import { MEETING_STATUS_LABELS } from "@/features/meetings/meeting-labels";
import type { MeetingStatus } from "@/types/api";

export default function MeetingsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<MeetingStatus | "ALL">("ALL");

  const { data, isLoading, isError, refetch } = useMeetings({
    page,
    pageSize: 12,
    status: status === "ALL" ? undefined : status,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reuniões</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} reunião${data.total === 1 ? "" : "ões"}` : "Carregando…"}
          </p>
        </div>
        <CreateMeetingDialog />
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as MeetingStatus | "ALL");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os status</SelectItem>
          {Object.entries(MEETING_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <MeetingsList meetings={data?.items ?? []} isLoading={isLoading} />
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
