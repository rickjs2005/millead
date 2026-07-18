"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACTIVITY_ICON, describeActivity } from "@/features/leads/activity-labels";
import { leadsService } from "@/services/leads";
import { useAuthStore } from "@/stores/auth-store";
import { formatDateTime } from "@/utils/format";

const SEEN_KEY = "millead-notifications-seen";

function getLastSeen(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = window.localStorage.getItem(SEEN_KEY);
  return raw ? Number(raw) : 0;
}

/**
 * Sino de notificações de verdade (era um ícone decorativo): mostra as
 * últimas atividades da organização. "Não lida" = mais nova que a última
 * abertura do popover (persistida em localStorage -- suficiente pra um
 * único usuário por browser, sem precisar de estado read/unread no banco).
 */
export function NotificationsBell() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission("leads:read");
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(getLastSeen);

  const { data: activities } = useQuery({
    queryKey: ["notifications", "recent"],
    queryFn: leadsService.recentActivities,
    enabled: canRead,
    refetchInterval: 60_000,
  });

  if (!canRead) return null;

  const unseen = (activities ?? []).filter((a) => new Date(a.createdAt).getTime() > lastSeen);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      const now = Date.now();
      window.localStorage.setItem(SEEN_KEY, String(now));
      setLastSeen(now);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative ml-auto md:ml-0">
          <Bell className="h-4 w-4" />
          {unseen.length > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unseen.length > 9 ? "9+" : unseen.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Notificações</div>
        <div className="max-h-80 overflow-y-auto">
          {!activities || activities.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma atividade recente.
            </p>
          ) : (
            activities.map((activity) => {
              const Icon = ACTIVITY_ICON[activity.type];
              const content = (
                <div className="flex items-start gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{describeActivity(activity)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(activity.createdAt)}
                    </p>
                  </div>
                </div>
              );
              return activity.leadId ? (
                <Link
                  key={activity.id}
                  href={`/leads/${activity.leadId}`}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              ) : (
                <div key={activity.id}>{content}</div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
