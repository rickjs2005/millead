import { prisma } from "@millead/database";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { env } from "../../../config/env.js";
import { asyncHandler } from "../async-handler.js";
import { validateBody } from "../middlewares/validate.js";
import { requireAuth } from "../require-auth.js";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(300),
    auth: z.string().min(1).max(300),
  }),
});

/**
 * Web Push (PWA): chave pública VAPID + inscrição/desinscrição do
 * dispositivo. Qualquer membro autenticado da org pode se inscrever —
 * as notificações são operacionais (briefing concluído etc.), não
 * carregam dado sensível além de título/rota.
 */
export function createNotificationRoutes(authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.get("/push/public-key", (_req, res) => {
    if (!env.VAPID_PUBLIC_KEY) {
      res.status(503).json({
        error: { code: "PUSH_NOT_CONFIGURED", message: "Web Push não configurado no servidor." },
      });
      return;
    }
    res.json({ key: env.VAPID_PUBLIC_KEY });
  });

  router.post(
    "/push/subscriptions",
    validateBody(subscriptionSchema),
    asyncHandler(async (req, res) => {
      const auth = requireAuth(req);
      const body = req.body as z.infer<typeof subscriptionSchema>;
      // upsert por endpoint: renovar a inscrição no mesmo navegador não duplica
      await prisma.pushSubscription.upsert({
        where: { endpoint: body.endpoint },
        create: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
        update: {
          organizationId: auth.organizationId,
          userId: auth.userId,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
      });
      res.status(201).json({ ok: true });
    }),
  );

  router.delete(
    "/push/subscriptions",
    asyncHandler(async (req, res) => {
      const auth = requireAuth(req);
      const endpoint = z.string().url().max(1000).safeParse(req.query.endpoint);
      if (!endpoint.success) {
        res
          .status(422)
          .json({ error: { code: "VALIDATION_ERROR", message: "endpoint inválido." } });
        return;
      }
      await prisma.pushSubscription.deleteMany({
        where: { endpoint: endpoint.data, organizationId: auth.organizationId },
      });
      res.json({ ok: true });
    }),
  );

  return router;
}
