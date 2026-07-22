import { prisma } from "@millead/database";
import webpush from "web-push";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { PushPayload, PushSender } from "../../domain/services/push-sender.js";

/**
 * Web Push (PWA) via VAPID. Sem as chaves configuradas o serviço vira no-op
 * silencioso — mesmo padrão dos módulos de IA/SMTP: a feature liga por env.
 * Inscrições mortas (410/404 = usuário revogou/limpou o navegador) são
 * removidas do banco na hora.
 */
export class WebPushSender implements PushSender {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    if (this.enabled) {
      webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
    }
  }

  async sendToOrg(organizationId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;
    const subs = await prisma.pushSubscription.findMany({ where: { organizationId } });
    if (!subs.length) return;
    const body = JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => null);
            logger.info({ endpoint: sub.endpoint.slice(0, 60) }, "push: inscrição morta removida");
          } else {
            logger.warn({ err, status }, "push: falha ao enviar (segue vivo)");
          }
        }
      }),
    );
  }
}
