"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Guarda de rota client-side -- não tem sessão de servidor (a API usa
 * Bearer token, não cookie), então a checagem só pode acontecer depois de
 * montar. `hydrated` evita um flash "não autenticado -> redireciona" antes
 * do Zustand `persist` terminar de ler o localStorage.
 */
export function useRequireAuth() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  // Começa sempre `false` -- ler `persist.hasHydrated()` como valor
  // inicial do useState rodaria durante o SSR/prerender também (não só no
  // client), onde `persist` não existe direito e derruba o build. Só é
  // seguro checar dentro do useEffect (garantidamente client-only).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace("/login");
    }
  }, [hydrated, accessToken, router]);

  return { ready: hydrated && !!accessToken };
}
