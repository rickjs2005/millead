"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ACTIVITY_ICON, describeActivity } from "@/features/leads/activity-labels";
import { leadsService } from "@/services/leads";
import { notificationsService } from "@/services/notifications";
import { useAuthStore } from "@/stores/auth-store";
import { formatDateTime } from "@/utils/format";
import { toast } from "sonner";

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
/** base64url (VAPID) → Uint8Array exigido pelo pushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Push suportado + já inscrito neste navegador? */
function usePushState() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied">("unsupported");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  return [state, setState] as const;
}

export function NotificationsBell() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission("leads:read");
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(getLastSeen);
  const [pushState, setPushState] = usePushState();

  async function enablePush() {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        return;
      }
      const { key } = await notificationsService.pushPublicKey();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
      const json = sub.toJSON();
      await notificationsService.subscribePush({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      });
      setPushState("on");
      toast.success("Notificações ativadas neste dispositivo.");
    } catch {
      toast.error("Não foi possível ativar as notificações.");
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await notificationsService.unsubscribePush(sub.endpoint).catch(() => null);
        await sub.unsubscribe();
      }
      setPushState("off");
      toast.success("Notificações desativadas neste dispositivo.");
    } catch {
      toast.error("Não foi possível desativar.");
    }
  }

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
        {pushState !== "unsupported" && (
          <div className="border-t border-border px-4 py-2.5">
            {pushState === "denied" ? (
              <p className="text-xs text-muted-foreground">
                Notificações bloqueadas pelo navegador — libere nas permissões do site.
              </p>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 px-0 text-xs"
                onClick={pushState === "on" ? disablePush : enablePush}
              >
                <BellRing className="h-3.5 w-3.5" />
                {pushState === "on"
                  ? "Desativar notificações neste dispositivo"
                  : "Ativar notificações neste dispositivo"}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
