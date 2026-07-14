import type { Request } from "express";
import type { RequestMeta } from "../../application/services/session-issuer.js";

export function getRequestMeta(req: Request): RequestMeta {
  const userAgent = req.headers["user-agent"];
  return {
    ipAddress: req.ip ?? null,
    userAgent: typeof userAgent === "string" ? userAgent : null,
  };
}
