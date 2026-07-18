"use client";

import { useEffect } from "react";

/** Registra o service worker (só em produção) pra tornar o app instalável. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // registro falhou -- não é crítico, o app funciona sem o SW.
    });
  }, []);

  return null;
}
