import { api } from "@/services/api-client";

export const notificationsService = {
  pushPublicKey: () => api.get<{ key: string }>("/api/v1/notifications/push/public-key"),
  subscribePush: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post<{ ok: boolean }>("/api/v1/notifications/push/subscriptions", sub),
  unsubscribePush: (endpoint: string) =>
    api.delete<{ ok: boolean }>(
      `/api/v1/notifications/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
    ),
};
